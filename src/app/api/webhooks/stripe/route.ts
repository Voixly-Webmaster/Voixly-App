import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/billing";
import { logActivity } from "@/lib/activity";
import {
  InvoiceStatus,
  PaymentStatus,
  RecurringStatus,
} from "@prisma/client";
import Stripe from "stripe";

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

function paymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const payments = (
    invoice as Stripe.Invoice & {
      payments?: { data?: Array<{ payment?: { payment_intent?: string | Stripe.PaymentIntent } }> };
    }
  ).payments?.data;
  const pi = payments?.[0]?.payment?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  const webhookSecret = await getStripeWebhookSecret();
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = (await getStripe()).webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await handleStripeInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleStripeInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChange(
        event.data.object as Stripe.Subscription
      );
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clientId = session.metadata?.clientId;

  if (session.mode === "setup" && session.metadata?.purpose === "autopay" && clientId) {
    await handleAutopaySetup(session, clientId);
    return;
  }

  const invoiceId = session.metadata?.invoiceId;
  const recurringInvoiceId = session.metadata?.recurringInvoiceId;

  if (!invoiceId || !clientId) return;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.clientId !== clientId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const paidAt = new Date();
  const markedPaid = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
    },
    data: { status: InvoiceStatus.PAID, paidAt },
  });

  await prisma.payment.updateMany({
    where: {
      stripeCheckoutSessionId: session.id,
      status: { not: PaymentStatus.SUCCEEDED },
    },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt,
      stripePaymentIntentId: paymentIntentId,
    },
  });

  if (markedPaid.count > 0) {
    await prisma.client.update({
      where: { id: clientId },
      data: { balanceCents: { decrement: invoice.amountCents } },
    });
  }

  if (session.mode === "subscription" && recurringInvoiceId) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (subscriptionId) {
      const stripe = await getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await prisma.recurringInvoice.update({
        where: { id: recurringInvoiceId },
        data: {
          status: RecurringStatus.ACTIVE,
          stripeSubscriptionId: subscriptionId,
          nextBillingAt: subscriptionPeriodEnd(subscription),
        },
      });
    }
  }

  if (markedPaid.count > 0) {
    await logActivity({
      clientId,
      action: "payment.succeeded",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: {
        sessionId: session.id,
        mode: session.mode,
        recurringInvoiceId,
      },
    });
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await prisma.payment.updateMany({
    where: {
      stripeCheckoutSessionId: session.id,
      status: PaymentStatus.PENDING,
    },
    data: { status: PaymentStatus.FAILED },
  });
}

async function handleAutopaySetup(
  session: Stripe.Checkout.Session,
  clientId: string
) {
  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;

  if (!setupIntentId) return;

  const stripe = await getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

  if (!paymentMethodId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.stripeCustomerId) return;

  await stripe.customers.update(client.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      autopayEnabled: true,
      stripePaymentMethodId: paymentMethodId,
      autopayEnabledAt: new Date(),
    },
  });

  await logActivity({
    clientId,
    action: "billing.autopay_enabled",
    entityType: "client",
    entityId: clientId,
    metadata: { paymentMethodId, sessionId: session.id },
  });

  // Charge any open invoices right away
  const { chargeInvoiceWithAutopay } = await import("@/lib/autopay");
  const unpaid = await prisma.invoice.findMany({
    where: {
      clientId,
      deletedAt: null,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
      recurringInvoiceId: null,
    },
    select: { id: true },
  });
  for (const inv of unpaid) {
    await chargeInvoiceWithAutopay(inv.id);
  }
}

/**
 * Renewal charges (and sometimes the first subscription invoice) arrive here.
 * The first period is usually already marked paid via checkout.session.completed;
 * we skip duplicates by stripeInvoiceId.
 */
async function handleStripeInvoicePaid(stripeInvoice: Stripe.Invoice) {
  if (stripeInvoice.billing_reason === "subscription_create") {
    // First invoice is handled by checkout.session.completed
    return;
  }

  const subscriptionId = subscriptionIdFromInvoice(stripeInvoice);
  if (!subscriptionId) return;

  const recurring = await prisma.recurringInvoice.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!recurring || recurring.status === RecurringStatus.CANCELLED) return;

  const existing = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });
  if (existing) return;

  const amountCents =
    stripeInvoice.amount_paid ??
    stripeInvoice.amount_due ??
    recurring.amountCents;

  const invoiceNumber = await generateInvoiceNumber();
  const paidAt = stripeInvoice.status_transitions?.paid_at
    ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
    : new Date();

  const invoice = await prisma.invoice.create({
    data: {
      clientId: recurring.clientId,
      recurringInvoiceId: recurring.id,
      invoiceNumber,
      title: recurring.title,
      description: recurring.description,
      amountCents,
      status: InvoiceStatus.PAID,
      dueDate: paidAt,
      sentAt: paidAt,
      paidAt,
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  await prisma.payment.create({
    data: {
      clientId: recurring.clientId,
      invoiceId: invoice.id,
      amountCents,
      status: PaymentStatus.SUCCEEDED,
      paidAt,
      stripePaymentIntentId: paymentIntentIdFromInvoice(stripeInvoice),
    },
  });

  const periodEnd = stripeInvoice.lines?.data?.[0]?.period?.end;
  await prisma.recurringInvoice.update({
    where: { id: recurring.id },
    data: {
      status: RecurringStatus.ACTIVE,
      nextBillingAt: periodEnd ? new Date(periodEnd * 1000) : undefined,
    },
  });

  await logActivity({
    clientId: recurring.clientId,
    action: "payment.recurring_succeeded",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: {
      stripeInvoiceId: stripeInvoice.id,
      recurringInvoiceId: recurring.id,
    },
  });
}

async function handleStripeInvoiceFailed(stripeInvoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdFromInvoice(stripeInvoice);
  if (!subscriptionId) return;

  const recurring = await prisma.recurringInvoice.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!recurring) return;

  const existing = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });
  if (existing) return;

  const amountCents =
    stripeInvoice.amount_due ?? recurring.amountCents;
  const invoiceNumber = await generateInvoiceNumber();

  await prisma.invoice.create({
    data: {
      clientId: recurring.clientId,
      recurringInvoiceId: recurring.id,
      invoiceNumber,
      title: recurring.title,
      description: recurring.description,
      amountCents,
      status: InvoiceStatus.FAILED,
      dueDate: new Date(),
      sentAt: new Date(),
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  await logActivity({
    clientId: recurring.clientId,
    action: "payment.recurring_failed",
    entityType: "recurring_invoice",
    entityId: recurring.id,
    metadata: { stripeInvoiceId: stripeInvoice.id },
  });

  const { notifyPaymentFailed } = await import("@/lib/outreach");
  await notifyPaymentFailed({
    clientId: recurring.clientId,
    invoiceNumber,
    title: recurring.title,
    amountCents,
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const recurring =
    (await prisma.recurringInvoice.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })) ??
    (subscription.metadata?.recurringInvoiceId
      ? await prisma.recurringInvoice.findUnique({
          where: { id: subscription.metadata.recurringInvoiceId },
        })
      : null);

  if (!recurring) return;

  let status: RecurringStatus = RecurringStatus.ACTIVE;
  if (
    subscription.status === "canceled" ||
    subscription.cancel_at_period_end
  ) {
    status =
      subscription.status === "canceled"
        ? RecurringStatus.CANCELLED
        : RecurringStatus.ACTIVE;
  } else if (
    subscription.status === "paused" ||
    subscription.status === "unpaid" ||
    subscription.status === "past_due"
  ) {
    status = RecurringStatus.PAUSED;
  } else if (
    subscription.status === "active" ||
    subscription.status === "trialing"
  ) {
    status = RecurringStatus.ACTIVE;
  }

  if (subscription.status === "canceled") {
    status = RecurringStatus.CANCELLED;
  }

  await prisma.recurringInvoice.update({
    where: { id: recurring.id },
    data: {
      status,
      stripeSubscriptionId: subscription.id,
      nextBillingAt:
        status === RecurringStatus.CANCELLED
          ? null
          : subscriptionPeriodEnd(subscription),
      cancelledAt:
        status === RecurringStatus.CANCELLED
          ? new Date()
          : recurring.cancelledAt,
    },
  });
}
