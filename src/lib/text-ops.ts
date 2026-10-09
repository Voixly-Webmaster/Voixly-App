import { revalidatePath } from "next/cache";
import { Prisma, SmsDirection, TaskStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { sendSms } from "@/lib/sms";
import { formatDateTime } from "@/lib/utils";
import { formatPhone, normalizePhone, phonesMatch } from "@/lib/phone";

type Actor = { actorId: string | null; botName?: string };

function refreshTexts(conversationId?: string) {
  try {
    revalidatePath("/admin/texts");
    revalidatePath("/admin");
    revalidatePath("/admin/tasks");
    revalidatePath("/portal/projects");
    if (conversationId) revalidatePath(`/admin/texts/${conversationId}`);
  } catch (err) {
    console.error("[texts] revalidate failed", err);
  }
}

function botMeta(actor: Actor, extra?: Record<string, string>) {
  return {
    ...(extra ?? {}),
    ...(actor.botName ? { bot: actor.botName } : {}),
  };
}

export async function sendConversationReply(
  conversationId: string,
  body: string,
  actor: Actor
): Promise<{ ok: true; messageId: string; sentAt: string } | { error: string }> {
  const conversation = await prisma.smsConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, phone: true, clientId: true },
  });
  if (!conversation) return { error: "That text thread was not found" };
  const message = body.trim();
  if (!message) return { error: "Write a reply first" };
  if (message.length > 1000) return { error: "Keep the reply under 1000 characters" };

  const sent = await sendSms({ to: conversation.phone, message });
  if (!sent.ok) return { error: sent.error };

  const now = new Date();
  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.smsMessage.create({
      data: {
        conversationId: conversation.id,
        voidfixId: sent.id ?? null,
        direction: SmsDirection.OUTBOUND,
        body: message,
        status: sent.dev ? "Logged" : "Pending",
        sentAt: now,
      },
      select: { id: true },
    });
    await tx.smsConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastPreview: message.replace(/\s+/g, " ").slice(0, 160),
      },
    });
    return created;
  });

  try {
    await logActivity({
      actorId: actor.actorId ?? undefined,
      clientId: conversation.clientId ?? undefined,
      action: "sms.replied",
      entityType: "sms",
      entityId: conversation.id,
      metadata: actor.botName ? { bot: actor.botName } : undefined,
    });
  } catch (err) {
    console.error("[texts] activity log failed", err);
  }

  refreshTexts(conversation.id);
  return { ok: true, messageId: saved.id, sentAt: now.toISOString() };
}

type TextPerson = {
  kind: "client" | "user";
  id: string;
  name: string;
  phone: string;
};

async function threadForPhone(phone: string) {
  const last10 = phone.slice(-10);
  const candidates = await prisma.smsConversation.findMany({
    where: { phone: { contains: last10 } },
    select: { id: true, phone: true, clientId: true, userId: true },
    take: 20,
  });
  return candidates.find((row) => phonesMatch(row.phone, phone)) ?? null;
}

type PhoneReader = {
  client: Prisma.TransactionClient["client"];
  user: Prisma.TransactionClient["user"];
};

async function phoneOwnedBySomeoneElse(
  db: PhoneReader,
  phone: string,
  clientId: string
): Promise<boolean> {
  const [clients, teammates] = await Promise.all([
    db.client.findMany({
      where: { deletedAt: null, id: { not: clientId }, NOT: { phone: null } },
      select: { phone: true },
    }),
    db.user.findMany({
      where: { deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
      select: { twoFactorPhone: true, staffProfile: { select: { phone: true } } },
    }),
  ]);
  return (
    clients.some((row) => phonesMatch(row.phone, phone)) ||
    teammates.some(
      (row) => phonesMatch(row.staffProfile?.phone, phone) || phonesMatch(row.twoFactorPhone, phone)
    )
  );
}

async function numberTaken(
  db: PhoneReader,
  existing: { clientId: string | null; userId: string | null } | null,
  person: TextPerson
): Promise<string | null> {
  if (!existing) return null;
  if (existing.clientId && !(person.kind === "client" && existing.clientId === person.id)) {
    const owner = await db.client.findFirst({
      where: { id: existing.clientId, deletedAt: null },
      select: { id: true },
    });
    if (owner) {
      return person.kind === "client"
        ? "That number is already linked to another customer"
        : "That number is already linked to a customer";
    }
  }
  if (existing.userId && !(person.kind === "user" && existing.userId === person.id)) {
    const owner = await db.user.findFirst({
      where: {
        id: existing.userId,
        deletedAt: null,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      select: { id: true },
    });
    if (owner) {
      return person.kind === "user"
        ? "That number is already linked to another teammate"
        : "That number is already linked to a teammate";
    }
  }
  return null;
}

async function sendTextToPerson(
  person: TextPerson,
  body: string,
  actor: Actor
): Promise<
  | { ok: true; conversationId: string; messageId: string; sentAt: string; phone: string }
  | { error: string }
> {
  const message = body.trim();
  if (!message) return { error: "Write a message first" };
  if (message.length > 1000) return { error: "Keep the text under 1000 characters" };

  const match = await threadForPhone(person.phone);
  const taken = await numberTaken(prisma, match, person);
  if (taken) return { error: taken };

  const sent = await sendSms({ to: person.phone, message });
  if (!sent.ok) return { error: sent.error };

  const now = new Date();
  const preview = message.replace(/\s+/g, " ").slice(0, 160);
  const owner = {
    clientId: person.kind === "client" ? person.id : null,
    userId: person.kind === "user" ? person.id : null,
  };
  const record = async () =>
    prisma.$transaction(async (tx) => {
      const existing = match
        ? await tx.smsConversation.findUnique({ where: { id: match.id } })
        : await tx.smsConversation.findUnique({ where: { phone: person.phone } });
      const blocked = await numberTaken(tx, existing, person);
      if (blocked) return { ok: false as const, error: blocked };
      const conversation = existing
        ? await tx.smsConversation.update({
            where: { id: existing.id },
            data: { ...owner, lastMessageAt: now, lastPreview: preview },
          })
        : await tx.smsConversation.create({
            data: {
              phone: person.phone,
              ...owner,
              lastMessageAt: now,
              lastPreview: preview,
              unreadCount: 0,
            },
          });
      const created = await tx.smsMessage.create({
        data: {
          conversationId: conversation.id,
          voidfixId: sent.id ?? null,
          direction: SmsDirection.OUTBOUND,
          body: message,
          status: sent.dev ? "Logged" : "Pending",
          sentAt: now,
        },
        select: { id: true },
      });
      return { ok: true as const, conversationId: conversation.id, messageId: created.id };
    });

  let saved: { conversationId: string; messageId: string };
  try {
    const recorded = await record();
    if (!recorded.ok) return { error: recorded.error };
    saved = recorded;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
    const existing = await prisma.smsConversation.findFirst({
      where: { OR: [{ phone: person.phone }, ...(match ? [{ id: match.id }] : [])] },
      select: { id: true, clientId: true, userId: true },
    });
    const blocked = await numberTaken(prisma, existing, person);
    if (!existing || blocked) return { error: blocked ?? "Could not save the text" };
    const created = await prisma.smsMessage.create({
      data: {
        conversationId: existing.id,
        voidfixId: sent.id ?? null,
        direction: SmsDirection.OUTBOUND,
        body: message,
        status: sent.dev ? "Logged" : "Pending",
        sentAt: now,
      },
      select: { id: true },
    });
    await prisma.smsConversation.update({
      where: { id: existing.id },
      data: { ...owner, lastMessageAt: now, lastPreview: preview },
    });
    saved = { conversationId: existing.id, messageId: created.id };
  }

  try {
    await logActivity({
      actorId: actor.actorId ?? undefined,
      clientId: person.kind === "client" ? person.id : undefined,
      action: "sms.sent",
      entityType: "sms",
      entityId: saved.conversationId,
      metadata: botMeta(actor, {
        phone: person.phone,
        ...(person.kind === "client" ? { companyName: person.name } : { name: person.name }),
      }),
    });
  } catch (err) {
    console.error("[texts] activity log failed", err);
  }

  refreshTexts(saved.conversationId);
  if (person.kind === "client") {
    try {
      revalidatePath(`/admin/clients/${person.id}`);
    } catch (err) {
      console.error("[texts] revalidate failed", err);
    }
  }
  return { ok: true, ...saved, sentAt: now.toISOString(), phone: person.phone };
}

export async function sendTextToCustomer(input: {
  clientId: string;
  body: string;
  actor: Actor;
}): Promise<
  | { ok: true; conversationId: string; messageId: string; sentAt: string; phone: string }
  | { error: string }
> {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, deletedAt: null },
    select: {
      id: true,
      companyName: true,
      phone: true,
      user: { select: { twoFactorPhone: true, deletedAt: true } },
    },
  });
  if (!client || client.user.deletedAt) return { error: "That customer was not found" };

  const phone =
    normalizePhone(client.phone ?? "") ?? normalizePhone(client.user.twoFactorPhone ?? "");
  if (!phone) return { error: "Add a full mobile number for this customer" };

  return sendTextToPerson(
    { kind: "client", id: client.id, name: client.companyName, phone },
    input.body,
    input.actor
  );
}

export async function sendTextToTeammate(input: {
  userId: string;
  body: string;
  actor: Actor;
}): Promise<
  | { ok: true; conversationId: string; messageId: string; sentAt: string; phone: string }
  | { error: string }
> {
  const teammate = await prisma.user.findFirst({
    where: {
      id: input.userId,
      deletedAt: null,
      role: { in: [UserRole.ADMIN, UserRole.STAFF] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      twoFactorPhone: true,
      staffProfile: { select: { phone: true } },
    },
  });
  if (!teammate) return { error: "That teammate was not found" };

  const phone =
    normalizePhone(teammate.staffProfile?.phone ?? "") ??
    normalizePhone(teammate.twoFactorPhone ?? "");
  if (!phone) return { error: "Add a full mobile number for this teammate" };

  return sendTextToPerson(
    { kind: "user", id: teammate.id, name: teammate.name?.trim() || teammate.email, phone },
    input.body,
    input.actor
  );
}

export async function linkConversationToClient(
  conversationId: string,
  clientId: string,
  actor: Actor
): Promise<{ ok: true } | { error: string }> {
  const conversation = await prisma.smsConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, phone: true, userId: true },
  });
  if (!conversation) return { error: "That text thread was not found" };
  if (conversation.userId) {
    const teammate = await prisma.user.findFirst({
      where: {
        id: conversation.userId,
        deletedAt: null,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      select: { id: true },
    });
    if (teammate) return { error: "That number belongs to a teammate" };
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true, companyName: true, phone: true },
  });
  if (!client) return { error: "Choose a customer" };

  await prisma.$transaction(async (tx) => {
    await tx.smsConversation.update({
      where: { id: conversation.id },
      data: { clientId: client.id, userId: null },
    });
    if (!client.phone?.trim() && !(await phoneOwnedBySomeoneElse(tx, conversation.phone, client.id))) {
      await tx.client.update({
        where: { id: client.id },
        data: { phone: conversation.phone },
      });
    }
  });

  try {
    await logActivity({
      actorId: actor.actorId ?? undefined,
      clientId: client.id,
      action: "sms.linked",
      entityType: "sms",
      entityId: conversation.id,
      metadata: botMeta(actor, { phone: conversation.phone, companyName: client.companyName }),
    });
  } catch (err) {
    console.error("[texts] activity log failed", err);
  }

  refreshTexts(conversation.id);
  try {
    revalidatePath(`/admin/clients/${client.id}`);
  } catch (err) {
    console.error("[texts] revalidate failed", err);
  }
  return { ok: true };
}

export async function createTaskFromInboundText(input: {
  messageId: string;
  title: string;
  assigneeId: string;
  createdById: string;
  actor: Actor;
}): Promise<{ ok: true; taskId: string } | { error: string }> {
  const message = await prisma.smsMessage.findUnique({
    where: { id: input.messageId },
    include: {
      conversation: {
        include: { client: { select: { id: true, companyName: true, deletedAt: true } } },
      },
      task: { select: { id: true, deletedAt: true } },
    },
  });
  if (!message || message.deletedAt || message.direction !== SmsDirection.INBOUND) {
    return { error: "That text was not found" };
  }
  if (message.task && !message.task.deletedAt) return { ok: true, taskId: message.task.id };

  const conversation = message.conversation;
  if (!conversation.clientId || conversation.client?.deletedAt) {
    return { error: "Link this number to a customer before making a task" };
  }

  const title = input.title.trim().slice(0, 140);
  if (!title) return { error: "Add a task title" };
  const assignee = await prisma.user.findFirst({
    where: {
      id: input.assigneeId,
      deletedAt: null,
      role: { in: [UserRole.ADMIN, UserRole.STAFF] },
    },
    select: { id: true },
  });
  if (!assignee) return { error: "Choose someone to assign the task to" };

  const description = [
    message.body,
    "",
    `Texted ${formatDateTime(message.sentAt)} from ${formatPhone(conversation.phone)}.`,
  ].join("\n");

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        description,
        clientId: conversation.clientId,
        assigneeId: assignee.id,
        status: TaskStatus.NEW,
        priority: "medium",
        scheduledDate: new Date(),
        clientVisible: true,
        createdById: input.createdById,
      },
    });
    await tx.smsMessage.update({
      where: { id: message.id },
      data: { taskId: created.id },
    });
    return created;
  });

  try {
    await logActivity({
      actorId: input.actor.actorId ?? undefined,
      clientId: conversation.clientId,
      action: "sms.task_created",
      entityType: "task",
      entityId: task.id,
      metadata: botMeta(input.actor, {
        companyName: conversation.client?.companyName ?? "",
      }),
    });
  } catch (err) {
    console.error("[texts] activity log failed", err);
  }

  refreshTexts(conversation.id);
  try {
    revalidatePath(`/admin/tasks/${task.id}`);
  } catch (err) {
    console.error("[texts] revalidate failed", err);
  }
  return { ok: true, taskId: task.id };
}
