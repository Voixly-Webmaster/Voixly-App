import { Resend } from "resend";
import { getSettings } from "@/lib/settings";
import { getAppUrl } from "@/lib/app-url";

const FONT = "Inter, Segoe UI, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(params: {
  preheader: string;
  title: string;
  bodyHtml: string;
  button?: { href: string; label: string };
  footnote?: string;
}): string {
  const button = params.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
        <tr>
          <td style="border-radius:10px;background:#FF6B4A;">
            <a href="${escapeHtml(params.button.href)}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${escapeHtml(params.button.label)}</a>
          </td>
        </tr>
      </table>`
    : "";
  const footnote = params.footnote
    ? `<p style="margin:28px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#7b8794;">${params.footnote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f0ec;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ec;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#0a0f14;padding:28px 32px 24px;">
                <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">Voixly</p>
                <p style="margin:8px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#FF6B4A;">ClientHub</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#FF6B4A;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 28px;">
                <h1 style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#0a0f14;">${escapeHtml(params.title)}</h1>
                <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:#3d4a54;">${params.bodyHtml}</div>
                ${button}
                ${footnote}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#94a3b8;">Voixly Digital Marketing</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRows(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row, index) => `<tr>
        <td style="padding:12px 0;border-top:${index === 0 ? "0" : "1px solid #ece7e2"};font-family:${FONT};font-size:13px;color:#7b8794;width:110px;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:12px 0;border-top:${index === 0 ? "0" : "1px solid #ece7e2"};font-family:${FONT};font-size:15px;font-weight:600;color:#0a0f14;vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">${cells}</table>`;
}

function quoteBlock(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr>
      <td style="padding:16px 18px;background:#f7f4f1;border-radius:12px;font-family:${FONT};font-size:15px;line-height:1.6;color:#3d4a54;">${text}</td>
    </tr>
  </table>`;
}

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

export function welcomeEmailHtml(params: {
  name: string | null;
  companyName: string;
  email: string;
  loginUrl: string;
}) {
  const greeting = params.name ? `Hi ${escapeHtml(params.name)},` : "Hi,";
  return emailShell({
    preheader: `Your Voixly portal for ${params.companyName} is ready.`,
    title: "Welcome to your portal",
    bodyHtml: `
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0;">Your client portal for <strong style="color:#0a0f14;">${escapeHtml(params.companyName)}</strong> is ready. Sign in to pay invoices, follow your work, share files, and message the Voixly team.</p>
    `,
    button: { href: params.loginUrl, label: "Open your portal" },
    footnote: `Sign in as ${escapeHtml(params.email)}. Your team will share the password with you. You can choose a new one anytime from the sign-in page.`,
  });
}

export async function sendClientWelcome(params: {
  email: string;
  name: string | null;
  companyName: string;
}): Promise<boolean> {
  try {
    const loginUrl = `${await getAppUrl()}/login`;
    const result = await sendEmail({
      to: params.email,
      subject: "Welcome to your Voixly portal",
      html: welcomeEmailHtml({ ...params, loginUrl }),
    });
    if ("dev" in result && result.dev && process.env.NODE_ENV === "production") return false;
    return result.ok;
  } catch (err) {
    console.error("[email] welcome failed", err);
    return false;
  }
}

export function ticketReplyEmailHtml(params: {
  ticketSubject: string;
  messagePreview: string;
  ticketUrl: string;
  isStaffReply: boolean;
}) {
  const title = params.isStaffReply ? "New reply on your ticket" : "New client message";
  return emailShell({
    preheader: `${params.ticketSubject}`,
    title,
    bodyHtml: `
      <p style="margin:0;">${escapeHtml(params.ticketSubject)}</p>
      ${quoteBlock(escapeHtml(params.messagePreview))}
    `,
    button: { href: params.ticketUrl, label: "View ticket" },
  });
}

export function invoiceEmailHtml(params: {
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  payUrl: string;
  title?: string;
  recurring?: boolean;
}) {
  return emailShell({
    preheader: `Invoice ${params.invoiceNumber} for ${params.amount} is ready.`,
    title: params.recurring ? "Your subscription is ready" : "Your invoice is ready",
    bodyHtml: `
      <p style="margin:0;">${
        params.recurring
          ? "This starts a recurring subscription. After you subscribe, Voixly charges the card on file each period."
          : "A new invoice is waiting in your portal."
      }</p>
      ${detailRows([
        { label: "Invoice", value: params.invoiceNumber },
        ...(params.title ? [{ label: "For", value: params.title }] : []),
        { label: "Amount", value: params.amount },
        { label: "Due", value: params.dueDate },
      ])}
    `,
    button: {
      href: params.payUrl,
      label: params.recurring ? "Subscribe and pay" : "Pay invoice",
    },
  });
}

export function signInCodeEmailHtml(params: {
  code: string;
  minutes: number;
  reason: string;
}) {
  return emailShell({
    preheader: `Your Voixly code is ${params.code}`,
    title: params.reason,
    bodyHtml: `
      <p style="margin:0;">Enter this code to continue. It expires in ${params.minutes} minutes.</p>
      <p style="margin:20px 0 0;padding:18px 12px;background:#0a0f14;border-radius:12px;text-align:center;font-family:${FONT};font-size:32px;letter-spacing:0.28em;font-weight:700;color:#ffffff;">${escapeHtml(params.code)}</p>
    `,
    footnote: "If you did not request this, you can ignore this email.",
  });
}

export function passwordResetEmailHtml(params: { resetUrl: string }) {
  return emailShell({
    preheader: "Choose a new Voixly password.",
    title: "Reset your password",
    bodyHtml: `<p style="margin:0;">Use the button below to choose a new password. This link expires in 1 hour and works once.</p>`,
    button: { href: params.resetUrl, label: "Choose a new password" },
    footnote: "If you did not ask for a reset, you can ignore this email. Your password will stay the same.",
  });
}

export function announcementEmailHtml(params: { title: string; body: string; url: string }) {
  const bodyHtml = escapeHtml(params.body).replace(/\n/g, "<br>");
  return emailShell({
    preheader: params.title,
    title: params.title,
    bodyHtml: quoteBlock(bodyHtml),
    button: { href: params.url, label: "View in the portal" },
  });
}

export function paymentFailedEmailHtml(params: {
  invoiceNumber: string;
  title: string;
  amount: string;
  payUrl: string;
}) {
  return emailShell({
    preheader: `Payment failed for invoice ${params.invoiceNumber}.`,
    title: "Payment needs attention",
    bodyHtml: `
      <p style="margin:0;">Update the card in your portal to pay this invoice.</p>
      ${detailRows([
        { label: "Invoice", value: params.invoiceNumber },
        { label: "For", value: params.title },
        { label: "Amount", value: params.amount },
      ])}
    `,
    button: { href: params.payUrl, label: "Review invoice" },
  });
}

export function testEmailHtml() {
  return emailShell({
    preheader: "Resend is connected to Voixly.",
    title: "Email is connected",
    bodyHtml: `<p style="margin:0;">This is a test from ClientHub. Invoices, announcements, ticket updates, and welcome notes will arrive in this style.</p>`,
  });
}
