"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireClient } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import {
  InvoiceStatus,
  PaymentStatus,
  RecurringStatus,
  UserRole,
} from "@prisma/client";
import {
  generateInvoiceNumber,
  intervalLabel,
  parseBillingInterval,
  toStripeInterval,
} from "@/lib/billing";

export async function createInvoice(formData: FormData) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");

  const clientId = formData.get("clientId") as string;
  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const dueDate = formData.get("dueDate") as string;
  const description = (formData.get("description") as string) || undefined;
  const recurring = formData.get("recurring") === "on";
  const interval = parseBillingInterval(formData.get("interval"));
  const productIdRaw = String(formData.get("productId") ?? "").trim();

  if (!clientId || !title?.trim() || isNaN(amount) || amount <= 0) {
    throw new Error("Client, title, and a positive amount are required");
  }
  if (recurring && !interval) {
    throw new Error("Choose a billing interval for recurring invoices");
  }
  await assertClientAccess(user, clientId);

  let productId: string | null = null;
  if (productIdRaw) {
    const product = await prisma.product.findFirst({
      where: { id: productIdRaw, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new Error("Selected product is not available");
    productId = product.id;
  }

  const amountCents = Math.round(amount * 100);
  const trimmedTitle = title.trim();
  const invoiceNumber = await generateInvoiceNumber();

  if (recurring && interval) {
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        clientId,
        productId,
        title: trimmedTitle,
        description,
        amountCents,
        interval,
        status: RecurringStatus.PENDING,
        createdById: user.id,
        invoices: {
          create: {
            clientId,
            title: trimmedTitle,
            description,
            amountCents,
            status: InvoiceStatus.SENT,
            dueDate: dueDate ? new Date(dueDate) : null,
            sentAt: new Date(),
            invoiceNumber,
          },
        },
      },
      include: { invoices: true },
    });

    const firstInvoice = recurringInvoice.invoices[0];
    await logActivity({
      actorId: user.id,
      clientId,
      action: "invoice.recurring_created",
      entityType: "recurring_invoice",
      entityId: recurringInvoice.id,
      metadata: {
        interval,
        invoiceId: firstInvoice?.id,
        amountCents,
      },
    });

    const { sendInvoiceCreatedEmail } = await import("@/lib/email");
    await sendInvoiceCreatedEmail({
      clientId,
      invoiceNumber,
      title: trimmedTitle,
      amountCents,
      dueDate: dueDate ? new Date(dueDate) : null,
      recurring: true,
    });
  } else {
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        title: trimmedTitle,
        description,
        amountCents,
        status: InvoiceStatus.SENT,
        dueDate: dueDate ? new Date(dueDate) : null,
        sentAt: new Date(),
        invoiceNumber,
      },
    });

    await logActivity({
      actorId: user.id,
      clientId,
      action: "invoice.created",
      entityType: "invoice",
      entityId: invoice.id,
    });

    const { sendInvoiceCreatedEmail } = await import("@/lib/email");
    await sendInvoiceCreatedEmail({
      clientId,
      invoiceNumber,
      title: trimmedTitle,
      amountCents,
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    // If the client has monthly Autopay on, charge their saved card now
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { autopayEnabled: true, stripePaymentMethodId: true },
    });
    if (client?.autopayEnabled && client.stripePaymentMethodId) {
      const { chargeInvoiceWithAutopay } = await import("@/lib/autopay");
      await chargeInvoiceWithAutopay(invoice.id);
    }
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/billing");
}

export async function createCheckoutSession(invoiceId: string) {
  const user = await requireClient();
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: user.clientId!,
      deletedAt: null,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
    },
    include: {
      client: true,
      recurringInvoice: true,
    },
  });

  if (!invoice) throw new Error("Invoice not found");

  const recurring = invoice.recurringInvoice;
  const isSubscription =
    !!recurring &&
    recurring.status !== RecurringStatus.CANCELLED &&
    !recurring.stripeSubscriptionId;

  let stripeCustomerId = invoice.client.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await (await getStripe()).customers.create({
      email: user.email,
      name: invoice.client.companyName,
      metadata: { clientId: invoice.clientId },
    });
    stripeCustomerId = customer.id;
    await prisma.client.update({
      where: { id: invoice.clientId },
      data: { stripeCustomerId },
    });
  }

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = await getAppUrl();
  const stripe = await getStripe();

  const productName = recurring
    ? `${invoice.title} (${intervalLabel(recurring.interval)})`
    : invoice.title;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: isSubscription ? "subscription" : "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            description: invoice.invoiceNumber,
          },
          unit_amount: invoice.amountCents,
          ...(isSubscription && recurring
            ? {
                recurring: {
                  interval: toStripeInterval(recurring.interval),
                },
              }
            : {}),
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      ...(recurring ? { recurringInvoiceId: recurring.id } : {}),
    },
    ...(isSubscription && recurring
      ? {
          subscription_data: {
            metadata: {
              recurringInvoiceId: recurring.id,
              clientId: invoice.clientId,
              firstInvoiceId: invoice.id,
            },
          },
        }
      : {}),
    success_url: `${appUrl}/portal/billing?paid=1`,
    cancel_url: `${appUrl}/portal/billing?cancelled=1`,
  });

  await prisma.payment.create({
    data: {
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      amountCents: invoice.amountCents,
      status: PaymentStatus.PENDING,
      stripeCheckoutSessionId: session.id,
    },
  });

  return { url: session.url };
}

export async function cancelRecurringInvoice(recurringInvoiceId: string) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");

  const recurring = await prisma.recurringInvoice.findUnique({
    where: { id: recurringInvoiceId },
  });
  if (!recurring) throw new Error("Recurring invoice not found");
  await assertClientAccess(user, recurring.clientId);

  if (recurring.status === RecurringStatus.CANCELLED) return;

  if (recurring.stripeSubscriptionId) {
    const stripe = await getStripe();
    try {
      await stripe.subscriptions.cancel(recurring.stripeSubscriptionId);
    } catch (err) {
      // Already cancelled in Stripe — still mark local record
      console.warn("[stripe] cancel subscription", err);
    }
  }

  await prisma.recurringInvoice.update({
    where: { id: recurringInvoiceId },
    data: {
      status: RecurringStatus.CANCELLED,
      cancelledAt: new Date(),
      nextBillingAt: null,
    },
  });

  await logActivity({
    actorId: user.id,
    clientId: recurring.clientId,
    action: "invoice.recurring_cancelled",
    entityType: "recurring_invoice",
    entityId: recurring.id,
  });

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/billing");
}

export async function markOverdueInvoices() {
  const { requireAdminRole } = await import("@/lib/session-guard");
  await requireAdminRole();
  await prisma.invoice.updateMany({
    where: {
      status: InvoiceStatus.SENT,
      dueDate: { lt: new Date() },
      deletedAt: null,
    },
    data: { status: InvoiceStatus.OVERDUE },
  });
}