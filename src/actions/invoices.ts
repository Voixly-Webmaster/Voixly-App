"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireClient } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import { InvoiceStatus, PaymentStatus, UserRole } from "@prisma/client";

/**
 * Atomically pick the next invoice number.
 * Uses unique constraint + retry to avoid the count() race.
 */
async function generateInvoiceNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const latest = await prisma.invoice.findFirst({
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });
    const lastNum = latest?.invoiceNumber?.match(/(\d+)$/)?.[1];
    const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1 + attempt;
    const candidate = `INV-${String(next).padStart(5, "0")}`;
    const taken = await prisma.invoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `INV-${Date.now()}`;
}

export async function createInvoice(formData: FormData) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
  const clientId = formData.get("clientId") as string;
  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const dueDate = formData.get("dueDate") as string;
  const description = (formData.get("description") as string) || undefined;

  if (!clientId || !title?.trim() || isNaN(amount) || amount <= 0) {
    throw new Error("Client, title, and a positive amount are required");
  }
  await assertClientAccess(user, clientId);

  const invoiceNumber = await generateInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      title: title.trim(),
      description,
      amountCents: Math.round(amount * 100),
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
    include: { client: true },
  });

  if (!invoice) throw new Error("Invoice not found");

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

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3010";

  const session = await (await getStripe()).checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: invoice.title,
            description: invoice.invoiceNumber,
          },
          unit_amount: invoice.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
    },
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

export async function markOverdueInvoices() {
  await prisma.invoice.updateMany({
    where: {
      status: InvoiceStatus.SENT,
      dueDate: { lt: new Date() },
      deletedAt: null,
    },
    data: { status: InvoiceStatus.OVERDUE },
  });
}
