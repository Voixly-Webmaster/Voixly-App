import { revalidatePath } from "next/cache";
import { SmsDirection, TaskStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { sendSms } from "@/lib/sms";
import { formatDateTime } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";

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

export async function linkConversationToClient(
  conversationId: string,
  clientId: string,
  actor: Actor
): Promise<{ ok: true } | { error: string }> {
  const conversation = await prisma.smsConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, phone: true },
  });
  if (!conversation) return { error: "That text thread was not found" };
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true, companyName: true, phone: true },
  });
  if (!client) return { error: "Choose a customer" };

  await prisma.$transaction(async (tx) => {
    await tx.smsConversation.update({
      where: { id: conversation.id },
      data: { clientId: client.id },
    });
    if (!client.phone?.trim()) {
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
