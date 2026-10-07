import { Resend } from "resend";
import { getSettings } from "@/lib/settings";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function ticketReplyEmailHtml(params: {
  ticketSubject: string;
  messagePreview: string;
  ticketUrl: string;
  isStaffReply: boolean;
}) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="color: #64748b; font-size: 14px;">ClientHub · Voixly</p>
      <h2 style="color: #0f172a;">${params.isStaffReply ? "New reply on your ticket" : "New client message"}</h2>
      <p style="color: #334155;"><strong>${escapeHtml(params.ticketSubject)}</strong></p>
      <p style="color: #475569; background: #f8fafc; padding: 16px; border-radius: 8px;">${escapeHtml(params.messagePreview)}</p>
      <a href="${escapeHtml(params.ticketUrl)}" style="display: inline-block; margin-top: 16px; background: #FF6B4A; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">View ticket</a>
    </div>
  `;
}

export function invoiceEmailHtml(params: {
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  payUrl: string;
  title?: string;
  recurring?: boolean;
}) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="color: #64748b; font-size: 14px;">ClientHub · Voixly</p>
      <h2 style="color: #0f172a;">Invoice ${escapeHtml(params.invoiceNumber)}</h2>
      ${params.title ? `<p style="color: #334155;">${escapeHtml(params.title)}</p>` : ""}
      <p style="color: #334155;">Amount due: <strong>${escapeHtml(params.amount)}</strong></p>
      <p style="color: #64748b;">Due: ${escapeHtml(params.dueDate)}</p>
      ${
        params.recurring
          ? `<p style="color: #475569; font-size: 14px;">This starts a recurring subscription. You'll be charged automatically after you subscribe.</p>`
          : ""
      }
      <a href="${escapeHtml(params.payUrl)}" style="display: inline-block; margin-top: 16px; background: #FF6B4A; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">${params.recurring ? "Subscribe & pay" : "Pay now"}</a>
    </div>
  `;
}

export async function sendInvoiceCreatedEmail(params: {
  clientId: string;
  invoiceNumber: string;
  title: string;
  amountCents: number;
  dueDate: Date | null;
  recurring?: boolean;
}) {
  const { prisma } = await import("@/lib/db");
  const { formatCurrency, formatDate } = await import("@/lib/utils");
  const { getAppUrl } = await import("@/lib/app-url");

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    include: { user: { select: { email: true } } },
  });
  const to = client?.user.email;
  if (!to) return;

  const appUrl = await getAppUrl();
  await sendEmail({
    to,
    subject: `Invoice ${params.invoiceNumber} — ${params.title}`,
    html: invoiceEmailHtml({
      invoiceNumber: params.invoiceNumber,
      title: params.title,
      amount: formatCurrency(params.amountCents),
      dueDate: formatDate(params.dueDate),
      payUrl: `${appUrl}/portal/billing`,
      recurring: params.recurring,
    }),
  });
}
