import { Resend } from "resend";
import { getSettings } from "@/lib/settings";
import { getAppUrl } from "@/lib/app-url";
import { renderEmail } from "@/lib/message-templates";

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

export async function sendClientWelcome(params: {
  email: string;
  name: string | null;
  companyName: string;
}): Promise<boolean> {
  try {
    const loginUrl = `${await getAppUrl()}/login`;
    const name = params.name?.trim() || "";
    const rendered = await renderEmail("welcome", {
      name,
      greeting: name ? `Hi ${name},` : "Hi,",
      company: params.companyName,
      email: params.email,
      loginUrl,
    });
    const result = await sendEmail({
      to: params.email,
      subject: rendered.subject,
      html: rendered.html,
    });
    if ("dev" in result && result.dev && process.env.NODE_ENV === "production") return false;
    return result.ok;
  } catch (err) {
    console.error("[email] welcome failed", err);
    return false;
  }
}
