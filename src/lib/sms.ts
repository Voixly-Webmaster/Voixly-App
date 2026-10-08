import { getSettings } from "@/lib/settings";

const DEFAULT_ENDPOINT = "https://sms.voidfix.com/services/send.php";

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

export async function voidfixConfigured(): Promise<boolean> {
  const settings = await getSettings(["voidfix.apiKey"]);
  return Boolean(settings["voidfix.apiKey"]);
}

/**
 * Send one SMS through VoidFix.
 * https://sms.voidfix.com/services/send.php — form fields key, number, message, optional devices.
 * The API returns HTTP 200 for failures too; success is the JSON `success` flag.
 */
export async function sendSms(params: { to: string; message: string }) {
  const settings = await getSettings(["voidfix.apiKey", "voidfix.deviceId"]);
  const key = settings["voidfix.apiKey"];
  const deviceId = settings["voidfix.deviceId"];

  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[sms:dev]", params.to, params.message);
      return { ok: true as const, dev: true as const };
    }
    return { ok: false as const, error: "VoidFix is not configured" };
  }

  const body = new URLSearchParams({
    key,
    number: params.to,
    message: params.message,
  });
  if (deviceId) body.set("devices", deviceId);

  let response: Response;
  try {
    response = await fetch(DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[sms] VoidFix request failed", err);
    return { ok: false as const, error: "Could not reach VoidFix" };
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
    return { ok: false as const, error: message };
  }

  return { ok: true as const };
}
