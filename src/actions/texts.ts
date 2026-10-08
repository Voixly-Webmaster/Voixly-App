"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Prisma, SmsDirection, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getAppUrl } from "@/lib/app-url";
import { pullInboundTexts, registerVoidfixWebhook } from "@/lib/sms-inbox";
import {
  createTaskFromInboundText,
  linkConversationToClient,
  sendConversationReply,
  sendTextToCustomer,
} from "@/lib/text-ops";

async function loadConversation(id: string) {
  return prisma.smsConversation.findUnique({
    where: { id },
    include: { client: { select: { id: true, companyName: true, phone: true, deletedAt: true } } },
  });
}

async function assertThreadAccess(
  user: Awaited<ReturnType<typeof requireAdmin>>,
  conversation: NonNullable<Awaited<ReturnType<typeof loadConversation>>>
) {
  if (!conversation.clientId || conversation.client?.deletedAt) {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    return;
  }
  await assertClientAccess(user, conversation.clientId);
}

function refreshTexts(conversationId?: string) {
  revalidatePath("/admin/texts");
  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  if (conversationId) revalidatePath(`/admin/texts/${conversationId}`);
}

export async function syncInboundTexts(): Promise<
  { ok: true; added: number } | { error: string }
> {
  try {
    const user = await requireAdmin();
    if (user.role !== UserRole.ADMIN) return { error: "Only an admin can check for new texts" };
    return await pullInboundTexts();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[texts] sync failed", err);
    return { error: "Could not check for new texts" };
  }
}

export async function registerSmsInbox(): Promise<{ ok: true; url: string } | { error: string }> {
  try {
    const user = await requireAdmin();
    if (user.role !== UserRole.ADMIN) return { error: "Only an admin can turn on the text inbox" };
    const url = `${await getAppUrl()}/api/webhooks/voidfix`;
    if (!url.startsWith("https://")) {
      return {
        error:
          "VoidFix needs a public https address. Set the app URL in Settings to https://app.voixly.com, then turn the inbox on.",
      };
    }
    const result = await registerVoidfixWebhook(url);
    if ("error" in result) return result;
    revalidatePath("/admin/settings/sms");
    return { ok: true, url };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[texts] webhook register failed", err);
    return { error: "Could not turn on the text inbox" };
  }
}

export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    const user = await requireAdmin();
    const conversation = await loadConversation(conversationId);
    if (!conversation || conversation.unreadCount === 0) return;
    await assertThreadAccess(user, conversation);
    await prisma.smsConversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    });
    revalidatePath("/admin/texts");
    revalidatePath("/admin");
  } catch (err) {
    unstable_rethrow(err);
  }
}

export async function linkTextToClient(
  conversationId: string,
  clientId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireAdmin();
    if (user.role !== UserRole.ADMIN) return { error: "Only an admin can link a text to a customer" };
    return linkConversationToClient(conversationId, clientId, { actorId: user.id });
  } catch (err) {
    unstable_rethrow(err);
    console.error("[texts] link failed", err);
    return { error: "Could not link this text to a customer" };
  }
}

export async function sendTextToClient(
  clientId: string,
  body: string
): Promise<{ ok: true; conversationId: string } | { error: string }> {
  try {
    const user = await requireAdmin();
    if (!clientId) return { error: "Choose a customer" };
    await assertClientAccess(user, clientId);
    const result = await sendTextToCustomer({
      clientId,
      body,
      actor: { actorId: user.id },
    });
    if ("error" in result) return result;
    return { ok: true, conversationId: result.conversationId };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot text this customer" };
    }
    console.error("[texts] outbound failed", err);
    return { error: "Could not send the text" };
  }
}

export async function replyToText(
  conversationId: string,
  body: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireAdmin();
    const conversation = await loadConversation(conversationId);
    if (!conversation) return { error: "That text thread was not found" };
    await assertThreadAccess(user, conversation);
    const result = await sendConversationReply(conversationId, body, { actorId: user.id });
    if ("error" in result) return result;
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot reply on this thread" };
    }
    console.error("[texts] reply failed", err);
    return { error: "Could not send the reply" };
  }
}

export async function createTaskFromText(input: {
  messageId: string;
  title: string;
  assigneeId: string;
}): Promise<{ ok: true; taskId: string } | { error: string }> {
  try {
    const user = await requireAdmin();
    const message = await prisma.smsMessage.findUnique({
      where: { id: input.messageId },
      select: {
        deletedAt: true,
        direction: true,
        conversation: {
          select: { clientId: true, client: { select: { deletedAt: true } } },
        },
      },
    });
    if (!message || message.deletedAt || message.direction !== SmsDirection.INBOUND) {
      return { error: "That text was not found" };
    }
    const clientId = message.conversation.clientId;
    if (!clientId || message.conversation.client?.deletedAt) {
      return { error: "Link this number to a customer before making a task" };
    }
    await assertClientAccess(user, clientId);
    return createTaskFromInboundText({
      messageId: input.messageId,
      title: input.title,
      assigneeId: input.assigneeId,
      createdById: user.id,
      actor: { actorId: user.id },
    });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot make a task from this text" };
    }
    console.error("[texts] task failed", err);
    return { error: "Could not create the task" };
  }
}

function cleanIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
}

function textPreview(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 160);
}

async function hideMessages(
  tx: Prisma.TransactionClient,
  where: Prisma.SmsMessageWhereInput
): Promise<{ deleted: number; emptied: string[] }> {
  const targets = await tx.smsMessage.findMany({
    where: { AND: [where, { deletedAt: null }] },
    select: { id: true, conversationId: true },
  });
  if (targets.length === 0) return { deleted: 0, emptied: [] };

  await tx.smsMessage.updateMany({
    where: { id: { in: targets.map((message) => message.id) } },
    data: { deletedAt: new Date() },
  });

  const conversationIds = [...new Set(targets.map((message) => message.conversationId))];
  const emptied: string[] = [];
  for (const conversationId of conversationIds) {
    const latest = await tx.smsMessage.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true, body: true },
    });
    if (!latest) {
      emptied.push(conversationId);
      await tx.smsConversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0, lastPreview: "" },
      });
      continue;
    }
    await tx.smsConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: latest.sentAt,
        lastPreview: textPreview(latest.body),
      },
    });
  }
  return { deleted: targets.length, emptied };
}

async function allowedConversationIds(
  user: Awaited<ReturnType<typeof requireAdmin>>,
  conversations: NonNullable<Awaited<ReturnType<typeof loadConversation>>>[]
): Promise<string[]> {
  const allowed: string[] = [];
  for (const conversation of conversations) {
    try {
      await assertThreadAccess(user, conversation);
      allowed.push(conversation.id);
    } catch (err) {
      unstable_rethrow(err);
    }
  }
  return allowed;
}

async function recordTextDeletion(actorId: string, deleted: number) {
  try {
    await logActivity({
      actorId,
      action: "sms.deleted",
      entityType: "sms",
      metadata: { count: deleted },
    });
  } catch (err) {
    console.error("[texts] activity log failed", err);
  }
}

export async function deleteTextThreads(
  ids: string[]
): Promise<{ ok: true; deleted: number; emptied: string[] } | { error: string }> {
  try {
    const user = await requireAdmin();
    const conversationIds = cleanIds(ids);
    if (conversationIds.length === 0) return { error: "Choose a conversation to delete" };

    const conversations = await prisma.smsConversation.findMany({
      where: { id: { in: conversationIds } },
      include: { client: { select: { id: true, companyName: true, phone: true, deletedAt: true } } },
    });
    const allowed = await allowedConversationIds(user, conversations);
    if (allowed.length === 0) return { error: "Those conversations were not found" };

    const result = await prisma.$transaction((tx) =>
      hideMessages(tx, { conversationId: { in: allowed } })
    );
    if (result.deleted === 0) return { error: "Those conversations were already removed" };

    await recordTextDeletion(user.id, result.deleted);
    refreshTexts();
    for (const id of allowed) revalidatePath(`/admin/texts/${id}`);
    return { ok: true, ...result };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[texts] delete threads failed", err);
    return { error: "Could not delete those conversations" };
  }
}

export async function deleteTextMessages(
  ids: string[]
): Promise<{ ok: true; deleted: number; emptied: string[] } | { error: string }> {
  try {
    const user = await requireAdmin();
    const messageIds = cleanIds(ids);
    if (messageIds.length === 0) return { error: "Choose a text to delete" };

    const messages = await prisma.smsMessage.findMany({
      where: { id: { in: messageIds }, deletedAt: null },
      select: { id: true, conversationId: true },
    });
    const conversationIds = [...new Set(messages.map((message) => message.conversationId))];
    const conversations = await prisma.smsConversation.findMany({
      where: { id: { in: conversationIds } },
      include: { client: { select: { id: true, companyName: true, phone: true, deletedAt: true } } },
    });
    const allowed = new Set(await allowedConversationIds(user, conversations));
    const deletable = messages
      .filter((message) => allowed.has(message.conversationId))
      .map((message) => message.id);
    if (deletable.length === 0) return { error: "Those texts were not found" };

    const result = await prisma.$transaction((tx) => hideMessages(tx, { id: { in: deletable } }));
    if (result.deleted === 0) return { error: "Those texts were already removed" };

    await recordTextDeletion(user.id, result.deleted);
    refreshTexts();
    for (const id of allowed) revalidatePath(`/admin/texts/${id}`);
    return { ok: true, ...result };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[texts] delete messages failed", err);
    return { error: "Could not delete those texts" };
  }
}
