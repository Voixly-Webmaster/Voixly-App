import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";
import type { BroadcastResult } from "@/lib/delivery-summary";

type SendOutcome = "sent" | "skipped" | "failed" | "unconfigured";

function classify(result: { ok: boolean; dev?: boolean }): SendOutcome {
  if (result.dev) {
    return process.env.NODE_ENV === "production" ? "unconfigured" : "sent";
  }
  return result.ok ? "sent" : "failed";
}

function contactPhone(primary: string | null | undefined, fallback: string | null | undefined) {
  return normalizePhone(primary ?? "") ?? normalizePhone(fallback ?? "");
}

async function clientContact(clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null, user: { deletedAt: null } },
    select: {
      phone: true,
      user: { select: { email: true, twoFactorPhone: true } },
    },
  });
  if (!client) return null;
  return {
    email: client.user.email,
    phone: contactPhone(client.phone, client.user.twoFactorPhone),
  };
}

export async function notifyClient(
  clientId: string,
  params: { subject: string; html: string; sms: string }
): Promise<{ email: SendOutcome; sms: SendOutcome }> {
  const contact = await clientContact(clientId);
  if (!contact) return { email: "skipped", sms: "skipped" };

  let email: SendOutcome = "skipped";
  let sms: SendOutcome = "skipped";

  if (contact.email) {
    try {
      email = classify(
        await sendEmail({ to: contact.email, subject: params.subject, html: params.html })
      );
    } catch (err) {
      console.error("[email] client notify failed", err);
      email = "failed";
    }
  }

  if (contact.phone) {
    try {
      sms = classify(await sendSms({ to: contact.phone, message: params.sms }));
    } catch (err) {
      console.error("[sms] client notify failed", err);
      sms = "failed";
    }
  }

  return { email, sms };
}

export async function textClient(clientId: string, message: string) {
  try {
    const contact = await clientContact(clientId);
    if (!contact?.phone) return;
    const result = await sendSms({ to: contact.phone, message });
    if (!result.ok) console.error("[sms]", "error" in result ? result.error : "text failed");
  } catch (err) {
    console.error("[sms] client text failed", err);
  }
}

/** Email and text every active client. One failure does not stop the rest. */
export async function broadcastToClients(params: {
  subject: string;
  html: string;
  sms: string;
}): Promise<BroadcastResult> {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, user: { deletedAt: null, role: UserRole.CLIENT } },
    select: {
      phone: true,
      user: { select: { email: true, twoFactorPhone: true } },
    },
  });

  const result: BroadcastResult = {
    recipients: clients.length,
    emailed: 0,
    emailFailed: 0,
    texted: 0,
    textFailed: 0,
    emailUnconfigured: false,
    smsUnconfigured: false,
  };

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const client of clients) {
    const email = client.user.email.trim().toLowerCase();
    if (email && !seenEmails.has(email) && !result.emailUnconfigured) {
      seenEmails.add(email);
      try {
        const outcome = classify(
          await sendEmail({ to: client.user.email, subject: params.subject, html: params.html })
        );
        if (outcome === "sent") result.emailed += 1;
        else if (outcome === "failed") result.emailFailed += 1;
        else if (outcome === "unconfigured") result.emailUnconfigured = true;
      } catch (err) {
        console.error("[email] announcement failed", err);
        result.emailFailed += 1;
      }
    }

    const phone = contactPhone(client.phone, client.user.twoFactorPhone);
    if (phone && !seenPhones.has(phone) && !result.smsUnconfigured) {
      seenPhones.add(phone);
      try {
        const outcome = classify(await sendSms({ to: phone, message: params.sms }));
        if (outcome === "sent") result.texted += 1;
        else if (outcome === "failed") result.textFailed += 1;
        else if (outcome === "unconfigured") result.smsUnconfigured = true;
      } catch (err) {
        console.error("[sms] announcement failed", err);
        result.textFailed += 1;
      }
    }
  }

  return result;
}

export async function notifyInvoiceCreated(params: {
  clientId: string;
  invoiceNumber: string;
  title: string;
  amountCents: number;
  dueDate: Date | null;
  recurring?: boolean;
}): Promise<{ emailSent: boolean; smsSent: boolean | null }> {
  const { renderEmail, renderSms } = await import("@/lib/message-templates");
  const { formatCurrency, formatDate } = await import("@/lib/utils");
  const { getAppUrl } = await import("@/lib/app-url");

  const payUrl = `${await getAppUrl()}/portal/billing`;
  const amount = formatCurrency(params.amountCents);
  const flowId = params.recurring ? "subscription" : "invoice";
  const vars = {
    invoiceNumber: params.invoiceNumber,
    item: params.title,
    amount,
    dueDate: formatDate(params.dueDate),
    payUrl,
  };
  const email = await renderEmail(flowId, vars);
  const delivery = await notifyClient(params.clientId, {
    subject: email.subject,
    html: email.html,
    sms: await renderSms(flowId, vars),
  });

  return {
    emailSent: delivery.email === "sent",
    smsSent: delivery.sms === "sent" ? true : delivery.sms === "failed" ? false : null,
  };
}

export async function notifyPaymentFailed(params: {
  clientId: string;
  invoiceNumber: string;
  title: string;
  amountCents: number;
}) {
  try {
    const { renderEmail, renderSms } = await import("@/lib/message-templates");
    const { formatCurrency } = await import("@/lib/utils");
    const { getAppUrl } = await import("@/lib/app-url");
    const payUrl = `${await getAppUrl()}/portal/billing`;
    const vars = {
      invoiceNumber: params.invoiceNumber,
      item: params.title,
      amount: formatCurrency(params.amountCents),
      payUrl,
    };
    const email = await renderEmail("payment-failed", vars);
    await notifyClient(params.clientId, {
      subject: email.subject,
      html: email.html,
      sms: await renderSms("payment-failed", vars),
    });
  } catch (err) {
    console.error("[notify] payment failure notice", err);
  }
}
