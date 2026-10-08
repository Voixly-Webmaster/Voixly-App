import { getSettings } from "@/lib/settings";
import { ingestVoidfixMessages, voidfixSignaturesMatch } from "@/lib/sms-inbox";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const settings = await getSettings(["voidfix.apiKey"]);
  const key = settings["voidfix.apiKey"];
  if (!key) return new Response("SMS is not configured", { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Expected a form post", { status: 400 });
  }

  const messages = form.get("messages");
  if (typeof messages !== "string" || !messages.trim()) {
    if (typeof form.get("ussdRequest") === "string") return new Response("ok");
    return new Response("Missing messages", { status: 400 });
  }

  const signature = request.headers.get("x-sg-signature") ?? "";
  if (!voidfixSignaturesMatch(messages, signature, key)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(messages);
  } catch {
    return new Response("Invalid messages", { status: 400 });
  }
  if (!Array.isArray(parsed)) return new Response("Invalid messages", { status: 400 });

  try {
    await ingestVoidfixMessages(parsed);
  } catch (err) {
    console.error("[sms-inbox] webhook failed", err);
    return new Response("Could not store messages", { status: 500 });
  }
  return new Response("ok");
}
