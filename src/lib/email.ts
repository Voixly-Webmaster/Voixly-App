import { Resend } from "resend";
import { getSettings } from "@/lib/settings";

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const settings = await getSettings(["resend.apiKey", "resend.fromEmail"]);
  const apiKey = settings["resend.apiKey"];
  const from = settings["resend.fromEmail"] ?? "ClientHub <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email:dev]", params.subject, "→", params.to);
    return { ok: true as const, dev: true };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error("[email]", error);
    return { ok: false as const, error };
  }
  return { ok: true as const };
}
