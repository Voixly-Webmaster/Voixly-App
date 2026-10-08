import { prisma } from "@/lib/db";
import {
  cleanFlowValues,
  composeMessage,
  getMessageFlow,
  mergeFlowValues,
  validateFlowValues,
  type MessageFlow,
} from "@/lib/message-catalog";

const TEMPLATE_KEY = "messages.templates";

export type MessageOverrides = Record<string, Record<string, string>>;

function parseOverrides(raw: string): MessageOverrides {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: MessageOverrides = {};
    for (const [flowId, fields] of Object.entries(parsed)) {
      const flow = getMessageFlow(flowId);
      if (!flow || typeof fields !== "object" || fields === null || Array.isArray(fields)) continue;
      const clean: Record<string, string> = {};
      for (const field of flow.fields) {
        const value = (fields as Record<string, unknown>)[field.key];
        if (typeof value === "string") clean[field.key] = value;
      }
      if (Object.keys(clean).length > 0) result[flowId] = clean;
    }
    return result;
  } catch {
    return {};
  }
}

export async function getMessageOverrides(): Promise<MessageOverrides> {
  const row = await prisma.appSetting.findUnique({ where: { key: TEMPLATE_KEY } });
  if (!row?.value) return {};
  return parseOverrides(row.value);
}

async function writeOverrides(overrides: MessageOverrides): Promise<void> {
  const value = JSON.stringify(overrides);
  await prisma.appSetting.upsert({
    where: { key: TEMPLATE_KEY },
    update: { value },
    create: { key: TEMPLATE_KEY, value },
  });
}

async function valuesFor(flow: MessageFlow): Promise<Record<string, string>> {
  const overrides = await getMessageOverrides();
  return mergeFlowValues(flow, overrides[flow.id]);
}

export async function renderEmail(
  flowId: string,
  vars: Record<string, string | null | undefined>
): Promise<{ subject: string; html: string }> {
  const flow = getMessageFlow(flowId);
  if (!flow) throw new Error("Unknown message");
  const composed = composeMessage(flow, await valuesFor(flow), vars);
  if (!composed.html || composed.subject == null) throw new Error("This message has no email");
  return { subject: composed.subject, html: composed.html };
}

export async function renderSms(
  flowId: string,
  vars: Record<string, string | null | undefined>
): Promise<string> {
  const flow = getMessageFlow(flowId);
  if (!flow) throw new Error("Unknown message");
  const composed = composeMessage(flow, await valuesFor(flow), vars);
  if (composed.sms == null) throw new Error("This message has no text");
  return composed.sms;
}

export async function saveMessageOverride(
  flowId: string,
  values: Record<string, string>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flow = getMessageFlow(flowId);
  if (!flow) return { ok: false, error: "Unknown message" };
  const clean = cleanFlowValues(flow, values);
  const invalid = validateFlowValues(flow, clean);
  if (invalid) return { ok: false, error: invalid };

  const overrides = await getMessageOverrides();
  const custom: Record<string, string> = {};
  for (const field of flow.fields) {
    if (clean[field.key] !== field.defaultValue) custom[field.key] = clean[field.key];
  }
  if (Object.keys(custom).length > 0) overrides[flowId] = custom;
  else delete overrides[flowId];

  try {
    await writeOverrides(overrides);
  } catch (err) {
    console.error("[messages] save failed", err);
    return { ok: false, error: "Could not save this message" };
  }
  return { ok: true };
}

export async function resetMessageOverride(
  flowId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getMessageFlow(flowId)) return { ok: false, error: "Unknown message" };
  const overrides = await getMessageOverrides();
  delete overrides[flowId];
  try {
    await writeOverrides(overrides);
  } catch (err) {
    console.error("[messages] reset failed", err);
    return { ok: false, error: "Could not reset this message" };
  }
  return { ok: true };
}
