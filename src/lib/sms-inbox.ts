import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, SmsDirection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { normalizePhone, phonesMatch } from "@/lib/phone";

const LIST_ENDPOINT = "https://sms.voidfix.com/services/v2/list-messages.php";
const WEBHOOK_GET_ENDPOINT = "https://sms.voidfix.com/services/v2/get-webhook.php";
const WEBHOOK_SET_ENDPOINT = "https://sms.voidfix.com/services/v2/set-webhook.php";
const CURSOR_KEY = "sms.inboundCursor";
const BODY_LIMIT = 4000;
const FRESH_MS = 48 * 60 * 60 * 1000;

function safeLog(err: unknown): string {
  const message = err instanceof Error ? err.message : "request failed";
  return message.replace(/key=[^&\s]+/gi, "key=(hidden)");
}

type PhoneIndex = { id: string; phone: string | null; twoFactorPhone: string | null }[];

export type ParsedVoidfixMessage =
  | {
      kind: "inbound";
      voidfixId: string;
      phone: string;
      body: string;
      status: string | null;
      sentAt: Date;
    }
  | { kind: "status"; voidfixId: string; status: string };

export function voidfixSignaturesMatch(payload: string, signature: string, key: string): boolean {
  if (!payload || !signature || !key) return false;
  const expected = createHmac("sha256", key).update(payload).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function messageId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return null;
}

function preview(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 160);
}

function messageBody(record: Record<string, unknown>): string {
  const text = typeof record.message === "string" ? record.message.trim() : "";
  const attachments = typeof record.attachments === "string" ? record.attachments.trim() : "";
  const combined = [text, attachments].filter(Boolean).join("\n");
  return (combined || "Empty text").slice(0, BODY_LIMIT);
}

function sentAtFrom(value: unknown): Date {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export function parseVoidfixMessage(raw: unknown): ParsedVoidfixMessage | null {
  const record = asRecord(raw);
  if (!record) return null;
  const voidfixId = messageId(record.ID);
  if (!voidfixId) return null;
  const status = typeof record.status === "string" ? record.status : null;
  const direction = typeof record.direction === "string" ? record.direction : null;
  const inbound = direction === "inbound" || (direction !== "outbound" && status === "Received");
  if (!inbound) {
    return status ? { kind: "status", voidfixId, status } : null;
  }
  const phone = typeof record.number === "string" ? normalizePhone(record.number) : null;
  if (!phone) return null;
  return {
    kind: "inbound",
    voidfixId,
    phone,
    body: messageBody(record),
    status,
    sentAt: sentAtFrom(record.sentDate),
  };
}

async function loadPhoneIndex(): Promise<PhoneIndex> {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, user: { deletedAt: null } },
    select: {
      id: true,
      phone: true,
      user: { select: { twoFactorPhone: true } },
    },
  });
  return clients.map((client) => ({
    id: client.id,
    phone: client.phone,
    twoFactorPhone: client.user.twoFactorPhone,
  }));
}

function matchClientId(index: PhoneIndex, phone: string): string | null {
  const hits = index.filter(
    (client) => phonesMatch(client.phone, phone) || phonesMatch(client.twoFactorPhone, phone)
  );
  const ids = [...new Set(hits.map((client) => client.id))];
  return ids.length === 1 ? ids[0] : null;
}

async function readCursor(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: CURSOR_KEY } });
  const value = Number(row?.value ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

async function writeCursor(value: number): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) return;
  const next = String(Math.trunc(value));
  await prisma.appSetting.upsert({
    where: { key: CURSOR_KEY },
    create: { key: CURSOR_KEY, value: next },
    update: { value: next },
  });
}

async function storeInbound(
  message: Extract<ParsedVoidfixMessage, { kind: "inbound" }>,
  index: PhoneIndex
): Promise<{ clientId: string | null } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.smsConversation.findUnique({ where: { phone: message.phone } });
      const matched = existing?.clientId ?? matchClientId(index, message.phone);
      const snippet = preview(message.body);
      const conversation = existing
        ? await tx.smsConversation.update({
            where: { id: existing.id },
            data: {
              clientId: existing.clientId ?? matched,
              ...(message.sentAt >= existing.lastMessageAt
                ? { lastMessageAt: message.sentAt, lastPreview: snippet }
                : {}),
              unreadCount: { increment: 1 },
            },
          })
        : await tx.smsConversation.create({
            data: {
              phone: message.phone,
              clientId: matched,
              lastMessageAt: message.sentAt,
              lastPreview: snippet,
              unreadCount: 1,
            },
          });

      await tx.smsMessage.create({
        data: {
          conversationId: conversation.id,
          voidfixId: message.voidfixId,
          direction: SmsDirection.INBOUND,
          body: message.body,
          status: message.status,
          sentAt: message.sentAt,
        },
      });
      return { clientId: conversation.clientId };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

export async function ingestVoidfixMessages(rawMessages: unknown[]): Promise<number> {
  const index = await loadPhoneIndex();
  const startCursor = await readCursor();
  let cursor = startCursor;
  let stored = 0;

  for (const raw of rawMessages) {
    const parsed = parseVoidfixMessage(raw);
    if (!parsed) continue;
    if (parsed.kind === "status") {
      await prisma.smsMessage.updateMany({
        where: { voidfixId: parsed.voidfixId },
        data: { status: parsed.status },
      });
      continue;
    }

    const saved = await storeInbound(parsed, index);
    const id = Number(parsed.voidfixId);
    if (id > cursor) cursor = id;
    if (!saved) continue;
    stored += 1;
    if (Date.now() - parsed.sentAt.getTime() <= FRESH_MS) {
      try {
        await logActivity({
          clientId: saved.clientId ?? undefined,
          action: "sms.received",
          entityType: "sms",
          entityId: parsed.voidfixId,
          metadata: { phone: parsed.phone },
        });
      } catch (err) {
        console.error("[sms-inbox] activity log failed", err);
      }
    }
  }

  if (cursor > startCursor) await writeCursor(cursor);
  if (stored > 0) {
    try {
      revalidatePath("/admin/texts");
      revalidatePath("/admin");
    } catch (err) {
      console.error("[sms-inbox] revalidate failed", err);
    }
  }
  return stored;
}

type VoidfixList = {
  messages: unknown[];
  hasMore: boolean;
  afterId: number | null;
};

async function voidfixGet(url: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const settings = await getSettings(["voidfix.apiKey"]);
  const key = settings["voidfix.apiKey"];
  if (!key) return { ok: false, error: "VoidFix is not configured" };
  const endpoint = new URL(url);
  endpoint.searchParams.set("key", key);
  let response: Response;
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    console.error("[sms-inbox] VoidFix request failed", safeLog(err));
    return { ok: false, error: "Could not reach VoidFix" };
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "VoidFix returned an unexpected response" };
  }
  const record = asRecord(payload);
  if (!record || record.success !== true) {
    const error = asRecord(record?.error);
    const message = typeof error?.message === "string" ? error.message : "VoidFix rejected the request";
    return { ok: false, error: message };
  }
  return { ok: true, data: record.data };
}

function highestId(messages: unknown[]): number {
  let max = 0;
  for (const raw of messages) {
    const id = Number(messageId(asRecord(raw)?.ID));
    if (id > max) max = id;
  }
  return max;
}

function parseList(data: unknown): VoidfixList {
  const record = asRecord(data);
  const messages = Array.isArray(record?.messages) ? record.messages : [];
  const next = asRecord(record?.next);
  const after = Number(next?.afterId);
  return {
    messages,
    hasMore: record?.hasMore === true,
    afterId: Number.isFinite(after) && after > 0 ? Math.trunc(after) : null,
  };
}

/** Pull inbound texts newer than the last one we stored. */
export async function pullInboundTexts(): Promise<{ ok: true; added: number } | { error: string }> {
  const settings = await getSettings(["voidfix.apiKey"]);
  if (!settings["voidfix.apiKey"]) return { error: "VoidFix is not configured" };

  let afterId = await readCursor();
  let added = 0;
  for (let page = 0; page < 5; page += 1) {
    const endpoint = new URL(LIST_ENDPOINT);
    endpoint.searchParams.set("direction", "inbound");
    endpoint.searchParams.set("limit", "50");
    if (afterId > 0) endpoint.searchParams.set("afterId", String(afterId));
    const result = await voidfixGet(endpoint.toString());
    if (!result.ok) return { error: result.error };
    const list = parseList(result.data);
    if (list.messages.length === 0) break;
    added += await ingestVoidfixMessages(list.messages);
    const highest = highestId(list.messages);
    if (!list.hasMore || highest <= afterId) break;
    afterId = highest;
  }
  return { ok: true, added };
}

export async function currentVoidfixWebhook(): Promise<string | null> {
  const result = await voidfixGet(WEBHOOK_GET_ENDPOINT);
  if (!result.ok) return null;
  const record = asRecord(result.data);
  const webhook = asRecord(record?.webhook);
  return typeof webhook?.url === "string" && webhook.url.trim() ? webhook.url.trim() : null;
}

export async function registerVoidfixWebhook(
  url: string
): Promise<{ ok: true } | { error: string }> {
  const settings = await getSettings(["voidfix.apiKey"]);
  const key = settings["voidfix.apiKey"];
  if (!key) return { error: "Add the VoidFix API key first" };
  let response: Response;
  try {
    response = await fetch(WEBHOOK_SET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key, url }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[sms-inbox] webhook register failed", safeLog(err));
    return { error: "Could not reach VoidFix" };
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { error: "VoidFix returned an unexpected response" };
  }
  const record = asRecord(payload);
  if (!record || record.success !== true) {
    const error = asRecord(record?.error);
    return {
      error: typeof error?.message === "string" ? error.message : "VoidFix did not save the inbox address",
    };
  }
  return { ok: true };
}
