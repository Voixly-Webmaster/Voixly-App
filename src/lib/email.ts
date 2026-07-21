import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const from = process.env.RESEND_FROM_EMAIL ?? "ClientHub <onboarding@resend.dev>";

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.info("[email:dev]", params.subject, "→", params.to);
    return { ok: true as const, dev: true };
  }

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
      <p style="color: #334155;"><strong>${params.ticketSubject}</strong></p>
      <p style="color: #475569; background: #f8fafc; padding: 16px; border-radius: 8px;">${params.messagePreview}</p>
      <a href="${params.ticketUrl}" style="display: inline-block; margin-top: 16px; background: #FF6B4A; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">View ticket</a>
    </div>
  `;
}

export function invoiceEmailHtml(params: {
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  payUrl: string;
}) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <p style="color: #64748b; font-size: 14px;">ClientHub · Voixly</p>
      <h2 style="color: #0f172a;">Invoice ${params.invoiceNumber}</h2>
      <p style="color: #334155;">Amount due: <strong>${params.amount}</strong></p>
      <p style="color: #64748b;">Due: ${params.dueDate}</p>
      <a href="${params.payUrl}" style="display: inline-block; margin-top: 16px; background: #FF6B4A; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Pay now</a>
    </div>
  `;
}
