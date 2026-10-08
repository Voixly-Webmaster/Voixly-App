import { revalidatePath } from "next/cache";
import { TaskStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { normalizePhone, phonesMatch } from "@/lib/phone";
import {
  createTaskFromInboundText,
  linkConversationToClient,
  sendConversationReply,
  sendTextToCustomer,
  sendTextToTeammate,
} from "@/lib/text-ops";
import { addStaffTicketReply } from "@/lib/ticket-reply";
import { botError, botJson, type BotContext } from "@/lib/bots";

const TASK_STATUSES = new Set<string>(Object.values(TaskStatus));

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function e164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return normalizePhone(phone) ?? phone;
}

function textOf(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function readObject(req: Request): Promise<Record<string, unknown> | Response> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return botError(400, "Send JSON");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return botError(400, "Send a JSON object");
  }
  return data as Record<string, unknown>;
}

function customerJson(client: {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  tier: string | null;
  balanceCents: number;
  user: { email: string };
}) {
  return {
    id: client.id,
    company: client.companyName,
    contact: client.contactName,
    email: client.user.email,
    phone: e164(client.phone),
    tier: client.tier,
    balanceCents: client.balanceCents,
  };
}

const customerSelect = {
  id: true,
  companyName: true,
  contactName: true,
  phone: true,
  tier: true,
  balanceCents: true,
  user: { select: { email: true } },
} as const;

export async function botMe(bot: BotContext) {
  return botJson({
    bot: { id: bot.id, name: bot.name },
    scopes: bot.scopes,
  });
}

export async function listCustomers(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const phone = url.searchParams.get("phone")?.trim() ?? "";

  if (phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return botError(400, "Send a phone number");
    const last4 = normalized.slice(-4);
    const candidates = await prisma.client.findMany({
      where: { deletedAt: null, phone: { contains: last4 } },
      select: customerSelect,
      take: 50,
    });
    const customers = candidates.filter((client) => phonesMatch(client.phone, normalized)).slice(0, 25);
    return botJson({ customers: customers.map(customerJson) });
  }

  const customers = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { companyName: { contains: q } },
              { contactName: { contains: q } },
              { user: { email: { contains: q } } },
            ],
          }
        : {}),
    },
    select: customerSelect,
    orderBy: { companyName: "asc" },
    take: 25,
  });
  return botJson({ customers: customers.map(customerJson) });
}

export async function getCustomer(id: string) {
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    select: customerSelect,
  });
  if (!client) return botError(404, "That customer was not found");
  return botJson({ customer: customerJson(client) });
}

export async function listInvoices(customerId: string) {
  const client = await prisma.client.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return botError(404, "That customer was not found");
  const invoices = await prisma.invoice.findMany({
    where: { clientId: customerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      invoiceNumber: true,
      title: true,
      status: true,
      amountCents: true,
      dueDate: true,
      paidAt: true,
    },
  });
  return botJson({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      title: invoice.title,
      status: invoice.status,
      amountCents: invoice.amountCents,
      dueDate: iso(invoice.dueDate),
      paidAt: iso(invoice.paidAt),
    })),
  });
}

function threadJson(thread: {
  id: string;
  phone: string;
  clientId: string | null;
  userId: string | null;
  unreadCount: number;
  lastPreview: string;
  lastMessageAt: Date;
  client: { companyName: string } | null;
  user: { name: string | null; email: string; deletedAt: Date | null } | null;
}) {
  const teammate = thread.user && !thread.user.deletedAt ? thread.user : null;
  return {
    id: thread.id,
    phone: e164(thread.phone),
    customerId: thread.clientId,
    company: thread.client?.companyName ?? null,
    userId: teammate ? thread.userId : null,
    teammate: teammate ? teammate.name?.trim() || teammate.email : null,
    unread: thread.unreadCount,
    preview: thread.lastPreview,
    lastMessageAt: thread.lastMessageAt.toISOString(),
  };
}

export async function listTexts(req: Request) {
  const unread = new URL(req.url).searchParams.get("unread") === "1";
  const threads = await prisma.smsConversation.findMany({
    where: {
      messages: { some: { deletedAt: null } },
      ...(unread ? { unreadCount: { gt: 0 } } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      phone: true,
      clientId: true,
      userId: true,
      unreadCount: true,
      lastPreview: true,
      lastMessageAt: true,
      client: { select: { companyName: true } },
      user: { select: { name: true, email: true, deletedAt: true } },
    },
  });
  return botJson({ texts: threads.map(threadJson) });
}

export async function getText(id: string) {
  const thread = await prisma.smsConversation.findUnique({
    where: { id },
    include: {
      client: { select: { companyName: true } },
      user: { select: { name: true, email: true, deletedAt: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "asc" },
        take: 200,
        select: { id: true, direction: true, body: true, sentAt: true, taskId: true },
      },
    },
  });
  if (!thread || thread.messages.length === 0) return botError(404, "That text was not found");
  if (thread.unreadCount > 0) {
    await prisma.smsConversation.update({
      where: { id: thread.id },
      data: { unreadCount: 0 },
    });
  }
  return botJson({
    text: {
      ...threadJson({ ...thread, unreadCount: 0 }),
      messages: thread.messages.map((message) => ({
        id: message.id,
        direction: message.direction === "INBOUND" ? "in" : "out",
        body: message.body,
        sentAt: message.sentAt.toISOString(),
        taskId: message.taskId,
      })),
    },
  });
}

function textResult(result: Awaited<ReturnType<typeof sendTextToCustomer>>) {
  if ("error" in result) {
    if (result.error === "That customer was not found" || result.error === "That teammate was not found") {
      return botError(404, result.error);
    }
    if (result.error.startsWith("That number is already linked")) return botError(409, result.error);
    return botError(400, result.error);
  }
  return botJson({
    text: {
      id: result.conversationId,
      phone: result.phone,
      message: { id: result.messageId, sentAt: result.sentAt },
    },
  });
}

export async function sendCustomerText(bot: BotContext, customerId: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const userId = textOf(body.userId, 64);
  const clientId = customerId || textOf(body.customerId, 64);
  if (userId && clientId) return botError(400, "Send a customerId or a userId, not both");
  const message = typeof body.body === "string" ? body.body : "";
  if (userId) {
    return textResult(
      await sendTextToTeammate({ userId, body: message, actor: { actorId: null, botName: bot.name } })
    );
  }
  if (!clientId) return botError(400, "Send a customerId or a userId");
  return textResult(
    await sendTextToCustomer({ clientId, body: message, actor: { actorId: null, botName: bot.name } })
  );
}

export async function sendTeammateText(bot: BotContext, userId: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  if (!userId) return botError(400, "Send a userId");
  return textResult(
    await sendTextToTeammate({
      userId,
      body: typeof body.body === "string" ? body.body : "",
      actor: { actorId: null, botName: bot.name },
    })
  );
}

export async function replyToText(bot: BotContext, id: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const result = await sendConversationReply(id, typeof body.body === "string" ? body.body : "", {
    actorId: null,
    botName: bot.name,
  });
  if ("error" in result) {
    const missing = result.error === "That text thread was not found";
    return botError(missing ? 404 : 400, result.error);
  }
  return botJson({ message: { id: result.messageId, sentAt: result.sentAt } });
}

export async function linkText(bot: BotContext, id: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const customerId = textOf(body.customerId, 64);
  if (!customerId) return botError(400, "Send a customerId");
  const result = await linkConversationToClient(id, customerId, {
    actorId: null,
    botName: bot.name,
  });
  if ("error" in result) {
    const missing = result.error === "That text thread was not found";
    return botError(missing ? 404 : 400, result.error);
  }
  return botJson({ ok: true });
}

async function assigneeId(requested: string, fallback: string): Promise<string | null> {
  const id = requested || fallback;
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function createTask(bot: BotContext, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const title = textOf(body.title, 140);
  if (!title) return botError(400, "Add a task title");
  const messageId = textOf(body.messageId, 64);
  const chosen = await assigneeId(textOf(body.assigneeId, 64), bot.createdById);
  if (!chosen) return botError(400, "Choose someone to assign the task to");

  if (messageId) {
    const result = await createTaskFromInboundText({
      messageId,
      title,
      assigneeId: chosen,
      createdById: bot.createdById,
      actor: { actorId: null, botName: bot.name },
    });
    if ("error" in result) {
      const missing = result.error === "That text was not found";
      return botError(missing ? 404 : 400, result.error);
    }
    const task = await prisma.task.findUnique({
      where: { id: result.taskId },
      select: { id: true, title: true, status: true, clientId: true, clientVisible: true },
    });
    return botJson({ task });
  }

  const customerId = textOf(body.customerId, 64);
  if (!customerId) return botError(400, "Send a customerId or a messageId");
  const client = await prisma.client.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, companyName: true },
  });
  if (!client) return botError(404, "That customer was not found");

  let dueDate: Date | null = null;
  if (body.dueDate != null && body.dueDate !== "") {
    if (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      return botError(400, "Send a due date as YYYY-MM-DD");
    }
    dueDate = new Date(`${body.dueDate}T12:00:00.000Z`);
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: textOf(body.description, 4000) || null,
      clientId: client.id,
      assigneeId: chosen,
      status: TaskStatus.NEW,
      priority: "medium",
      scheduledDate: new Date(),
      dueDate,
      clientVisible: body.clientVisible === true,
      createdById: bot.createdById,
    },
    select: { id: true, title: true, status: true, clientId: true, clientVisible: true },
  });

  try {
    await logActivity({
      clientId: client.id,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      metadata: { bot: bot.name, companyName: client.companyName },
    });
  } catch (err) {
    console.error("[bots] activity log failed", err);
  }
  try {
    revalidatePath("/admin/tasks");
    revalidatePath("/portal/projects");
  } catch (err) {
    console.error("[bots] revalidate failed", err);
  }

  return botJson({ task }, 201);
}

export async function updateTask(bot: BotContext, id: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!task) return botError(404, "That task was not found");

  const data: {
    status?: TaskStatus;
    title?: string;
    clientVisible?: boolean;
    completed?: boolean;
  } = {};
  if (body.status != null) {
    if (typeof body.status !== "string" || !TASK_STATUSES.has(body.status)) {
      return botError(400, "Send a task status");
    }
    data.status = body.status as TaskStatus;
    if (data.status === TaskStatus.COMPLETED) data.completed = true;
  }
  if (body.title != null) {
    const title = textOf(body.title, 140);
    if (!title) return botError(400, "Add a task title");
    data.title = title;
  }
  if (body.clientVisible != null) {
    if (typeof body.clientVisible !== "boolean") return botError(400, "clientVisible must be true or false");
    data.clientVisible = body.clientVisible;
  }
  if (body.completed != null) {
    if (typeof body.completed !== "boolean") return botError(400, "completed must be true or false");
    data.completed = body.completed;
  }
  if (Object.keys(data).length === 0) return botError(400, "Send a change to make");

  const updated = await prisma.task.update({
    where: { id: task.id },
    data,
    select: { id: true, title: true, status: true, clientId: true, clientVisible: true, completed: true },
  });
  try {
    await logActivity({
      clientId: task.clientId ?? undefined,
      action: "task.updated",
      entityType: "task",
      entityId: task.id,
      metadata: { bot: bot.name },
    });
  } catch (err) {
    console.error("[bots] activity log failed", err);
  }
  try {
    revalidatePath("/admin/tasks");
    revalidatePath(`/admin/tasks/${task.id}`);
    revalidatePath("/portal/projects");
  } catch (err) {
    console.error("[bots] revalidate failed", err);
  }
  return botJson({ task: updated });
}

export async function listTickets(req: Request) {
  const status = new URL(req.url).searchParams.get("status")?.trim().toUpperCase() ?? "";
  if (status && status !== "OPEN" && status !== "WAITING" && status !== "RESOLVED") {
    return botError(400, "Send a ticket status of OPEN, WAITING, or RESOLVED");
  }
  const tickets = await prisma.supportTicket.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status: status as "OPEN" | "WAITING" | "RESOLVED" } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      clientId: true,
      subject: true,
      status: true,
      updatedAt: true,
      client: { select: { companyName: true } },
    },
  });
  return botJson({
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      customerId: ticket.clientId,
      company: ticket.client.companyName,
      subject: ticket.subject,
      status: ticket.status,
      updatedAt: ticket.updatedAt.toISOString(),
    })),
  });
}

export async function replyToTicket(bot: BotContext, id: string, req: Request) {
  const body = await readObject(req);
  if (body instanceof Response) return body;
  const result = await addStaffTicketReply({
    ticketId: id,
    body: typeof body.body === "string" ? body.body : "",
    authorId: bot.createdById,
    botName: bot.name,
  });
  if ("error" in result) {
    const missing = result.error === "That ticket was not found";
    return botError(missing ? 404 : 400, result.error);
  }
  return botJson({ ok: true });
}
