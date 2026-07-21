import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import Stripe from "stripe";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    const clientId = session.metadata?.clientId;

    if (invoiceId && clientId) {
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.PAID, paidAt: new Date() },
        }),
        prisma.payment.updateMany({
          where: { stripeCheckoutSessionId: session.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            paidAt: new Date(),
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id,
          },
        }),
        prisma.client.update({
          where: { id: clientId },
          data: { balanceCents: { decrement: session.amount_total ?? 0 } },
        }),
      ]);

      await logActivity({
        clientId,
        action: "payment.succeeded",
        entityType: "invoice",
        entityId: invoiceId,
        metadata: { sessionId: session.id },
      });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await prisma.payment.updateMany({
      where: { stripeCheckoutSessionId: session.id },
      data: { status: PaymentStatus.FAILED },
    });
  }

  return NextResponse.json({ received: true });
}
