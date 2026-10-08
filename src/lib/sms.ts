import { createHash } from "crypto";
import { getSettings } from "@/lib/settings";

const SEND_ENDPOINT = "https://sms.voidfix.com/services/send.php";
const DEVICES_ENDPOINT = "https://sms.voidfix.com/services/get-devices.php";

type SimSlot = 0 | 1;

type ListedSim = {
  slot: SimSlot;
  label: string;
  number: string | null;
};

export type ListedDevice = {
  id: number;
  name: string | null;
  model: string | null;
  sims: ListedSim[];
};

type SendFailure = { ok: false; error: string };
type SendSuccess = { ok: true; dev?: true };

function voidfixErrorMessage(payload: unknown, status: number, parsed: boolean): string {
  if (!parsed) return `VoidFix returned an unexpected response (HTTP ${status}).`;
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
    if (typeof error === "object" && error !== null) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  return `VoidFix rejected the message (HTTP ${status}).`;
}

function phoneInLabel(label: string): string | null {
  return label.match(/\+\d{8,15}/)?.[0] ?? null;
}

/** Device id from Settings, including `1383|1` when a SIM slot was saved with it. */
export function parseDeviceSetting(
  raw: string | null | undefined
): { id: string; simSlot: SimSlot | null } | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const explicit = value.match(/^(\d+)\s*[|:]\s*([01])$/);
  if (explicit) return { id: explicit[1], simSlot: Number(explicit[2]) as SimSlot };
  const id = value.match(/\d+/)?.[0];
  if (!id) return null;
  return { id, simSlot: null };
}

function missingSimTarget(message: string): { id: string; slot: SimSlot } | null {
  const match = message.match(/no SIM card present[\s\S]*?\[\s*"(\d+)"\s*,\s*"([01])"\s*\]/i);
  if (!match) return null;
  return { id: match[1], slot: Number(match[2]) as SimSlot };
}

function otherSlot(slot: SimSlot): SimSlot {
  return slot === 0 ? 1 : 0;
}

function simName(slot: SimSlot): string {
  return slot === 0 ? "SIM 1" : "SIM 2";
}

/** Prefer a slot whose label includes a phone number. Slot 0 is SIM 1. */
export function pickSimSlot(sims: ListedSim[], preferred: SimSlot | null): SimSlot | null {
  const ready = sims.filter((sim) => sim.number);
  if (preferred !== null && ready.some((sim) => sim.slot === preferred)) return preferred;
  if (ready.length > 0) return ready[0].slot;
  if (preferred !== null) return preferred;
  return sims[0]?.slot ?? null;
}

function parseDevices(payload: unknown): ListedDevice[] {
  const devices = (payload as { data?: { devices?: unknown } } | null)?.data?.devices;
  if (!Array.isArray(devices)) return [];
  return devices.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "number") return [];
    const name = (item as { name?: unknown }).name;
    const model = (item as { model?: unknown }).model;
    const simsRaw = (item as { sims?: unknown }).sims;
    const sims: ListedSim[] = [];
    if (typeof simsRaw === "object" && simsRaw !== null) {
      for (const [key, label] of Object.entries(simsRaw)) {
        const slot = Number(key);
        if ((slot !== 0 && slot !== 1) || typeof label !== "string") continue;
        sims.push({ slot, label, number: phoneInLabel(label) });
      }
      sims.sort((a, b) => a.slot - b.slot);
    }
    return [
      {
        id,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        model: typeof model === "string" && model.trim() ? model.trim() : null,
        sims,
      },
    ];
  });
}

const deviceCache = new Map<string, { at: number; devices: ListedDevice[] }>();

function cacheKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

async function fetchDevices(apiKey: string): Promise<ListedDevice[] | null> {
  const fingerprint = cacheKey(apiKey);
  const cached = deviceCache.get(fingerprint);
  if (cached && Date.now() - cached.at < 30_000) return cached.devices;

  let response: Response;
  try {
    const url = new URL(DEVICES_ENDPOINT);
    url.searchParams.set("key", apiKey);
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    const detail = err instanceof Error ? err.message.replaceAll(apiKey, "[key]") : "request failed";
    console.error("[sms] Could not list VoidFix phones", detail);
    return null;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  const success =
    typeof payload === "object" &&
    payload !== null &&
    (payload as { success?: unknown }).success === true;
  if (!success) return null;

  const devices = parseDevices(payload);
  deviceCache.set(fingerprint, { at: Date.now(), devices });
  return devices;
}

export async function listVoidfixDevices(): Promise<
  { ok: true; devices: ListedDevice[] } | SendFailure
> {
  const settings = await getSettings(["voidfix.apiKey"]);
  const key = settings["voidfix.apiKey"];
  if (!key) return { ok: false, error: "VoidFix is not configured" };
  const devices = await fetchDevices(key);
  if (!devices) return { ok: false, error: "Could not list phones from VoidFix" };
  return { ok: true, devices };
}

export async function voidfixConfigured(): Promise<boolean> {
  const settings = await getSettings(["voidfix.apiKey"]);
  return Boolean(settings["voidfix.apiKey"]);
}

async function postSms(body: URLSearchParams): Promise<SendSuccess | SendFailure> {
  let response: Response;
  try {
    response = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[sms] VoidFix request failed", err);
    return { ok: false, error: "Could not reach VoidFix" };
  }

  let payload: unknown = null;
  let parsed = false;
  try {
    payload = await response.json();
    parsed = true;
  } catch {
    payload = null;
  }

  const success =
    typeof payload === "object" &&
    payload !== null &&
    (payload as { success?: unknown }).success === true;

  if (!response.ok || !success) {
    const message = voidfixErrorMessage(payload, response.status, parsed);
    console.error("[sms]", message);
    return { ok: false, error: message };
  }

  return { ok: true };
}

function sendBody(params: {
  key: string;
  to: string;
  message: string;
  deviceId?: string;
  simSlot?: SimSlot | null;
}): URLSearchParams {
  const body = new URLSearchParams({
    key: params.key,
    number: params.to,
    message: params.message,
  });
  if (params.deviceId) body.set("devices", params.deviceId);
  if (params.deviceId && (params.simSlot === 0 || params.simSlot === 1)) {
    body.set("simSlot", String(params.simSlot));
  }
  return body;
}

function emptySimMessage(deviceId: string, tried: SimSlot[]): string {
  const slots = tried.map((slot) => simName(slot)).join(" and ");
  return `Phone ${deviceId} is showing in VoidFix, but ${slots} reported no SIM card. Open the SMS Gateway app on that phone and confirm a SIM is detected.`;
}

/**
 * Send one SMS through VoidFix.
 * https://sms.voidfix.com/services/send.php — form fields key, number, message, optional devices.
 * The API returns HTTP 200 for failures too; success is the JSON `success` flag.
 * `devices=1383` always means SIM 1. If that slot is empty, the other slot is tried.
 */
export async function sendSms(params: { to: string; message: string }): Promise<SendSuccess | SendFailure> {
  const settings = await getSettings(["voidfix.apiKey", "voidfix.deviceId"]);
  const key = settings["voidfix.apiKey"];
  const preferred = parseDeviceSetting(settings["voidfix.deviceId"]);

  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[sms:dev]", params.to, params.message);
      return { ok: true, dev: true };
    }
    return { ok: false, error: "VoidFix is not configured" };
  }

  let deviceId = preferred?.id;
  let simSlot: SimSlot | null = preferred?.simSlot ?? null;

  const listed = await fetchDevices(key);
  if (listed && preferred) {
    const device = listed.find((item) => String(item.id) === preferred.id);
    if (!device) {
      const names = listed
        .map((item) => (item.name ? `${item.name} (${item.id})` : String(item.id)))
        .join(", ");
      return {
        ok: false,
        error: names
          ? `VoidFix does not list phone ${preferred.id}. Connected phones: ${names}.`
          : `VoidFix does not list phone ${preferred.id}, and no phones are connected.`,
      };
    }
    simSlot = pickSimSlot(device.sims, preferred.simSlot);
    deviceId = String(device.id);
  }

  const first = await postSms(
    sendBody({ key, to: params.to, message: params.message, deviceId, simSlot })
  );
  if (first.ok || !missingSimTarget(first.error)) return first;

  const missing = missingSimTarget(first.error)!;
  const retryId = deviceId ?? missing.id;
  const retrySlot = otherSlot(missing.slot);
  if (simSlot === retrySlot && deviceId === retryId) return first;

  const second = await postSms(
    sendBody({
      key,
      to: params.to,
      message: params.message,
      deviceId: retryId,
      simSlot: retrySlot,
    })
  );
  if (second.ok) return second;
  if (missingSimTarget(second.error)) {
    return { ok: false, error: emptySimMessage(retryId, [missing.slot, retrySlot]) };
  }
  return second;
}
