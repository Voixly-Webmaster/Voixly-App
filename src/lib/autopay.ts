import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";

export async function ensureStripeCustomer(params: {
  clientId: string;
  email: string;
  companyName: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) return params.existingCustomerId;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.companyName,
    metadata: { clientId: params.clientId },
  });

  await prisma.client.update({
    where: { id: params.clientId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Charge a single unpaid invoice using the client's saved autopay card.
 * Returns true if paid successfully.
 */
export async function chargeInvoiceWithAutopay(invoiceId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      deletedAt: null,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
    },
    include: { client: true },
  });

  if (!invoice) return { ok: false, reason: "Invoice not found" };
  if (invoice.recurringInvoiceId) {
    return { ok: false, reason: "Recurring invoices are billed by Stripe" };
  }

  const client = invoice.client;
  if (!client.autopayEnabled || !client.stripePaymentMethodId) {
    return { ok: false, reason: "Autopay not enabled" };
  }
  if (!client.stripeCustomerId) {
    return { ok: false, reason: "No Stripe customer" };
  }

  const stripe = await getStripe();

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amountCents,
      currency: "usd",
      customer: client.stripeCustomerId,
      payment_method: client.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      description: `${invoice.invoiceNumber} — ${invoice.title}`,
      metadata: {
        invoiceId: invoice.id,
        clientId: client.id,
        source: "autopay",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return { ok: false, reason: `Payment status: ${paymentIntent.status}` };
    }

    const paidAt = new Date();
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt },
      }),
      prisma.payment.create({
        data: {
          clientId: client.id,
          invoiceId: invoice.id,
          amountCents: invoice.amountCents,
          status: PaymentStatus.SUCCEEDED,
          paidAt,
          stripePaymentIntentId: paymentIntent.id,
        },
      }),
      prisma.client.update({
        where: { id: client.id },
        data: { balanceCents: { decrement: invoice.amountCents } },
      }),
    ]);

    await logActivity({
      clientId: client.id,
      action: "payment.autopay_succeeded",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { paymentIntentId: paymentIntent.id },
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    console.error("[autopay] charge failed", invoiceId, message);

    await logActivity({
      clientId: client.id,
      action: "payment.autopay_failed",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { error: message },
    });

    return { ok: false, reason: message };
  }
}

/** Charge every unpaid invoice for clients with autopay whose day matches today. */
export async function runMonthlyAutopaySweep(options?: {
  /** Force all autopay clients regardless of day-of-month */
  forceAll?: boolean;
  dayOfMonth?: number;
}): Promise<{ clients: number; charged: number; failed: number }> {
  const day = options?.dayOfMonth ?? new Date().getDate();

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      autopayEnabled: true,
      stripePaymentMethodId: { not: null },
      ...(options?.forceAll ? {} : { autopayDay: day }),
    },
    select: { id: true },
  });

  let charged = 0;
  let failed = 0;

  for (const client of clients) {
    const unpaid = await prisma.invoice.findMany({
      where: {
        clientId: client.id,
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        recurringInvoiceId: null,
      },
      select: { id: true },
    });

    for (const inv of unpaid) {
      const result = await chargeInvoiceWithAutopay(inv.id);
      if (result.ok) charged += 1;
      else failed += 1;
    }
  }

  return { clients: clients.length, charged, failed };
}
