"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/autopay";
import { logActivity } from "@/lib/activity";
import { getSetting } from "@/lib/settings";

/** Start Stripe Checkout (setup mode) so the client can save a card for monthly autopay. */
export async function createAutopaySetupSession() {
  const user = await requireClient();
  const clientId = user.clientId!;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  const customerId = await ensureStripeCustomer({
    clientId,
    email: user.email,
    companyName: client.companyName,
    existingCustomerId: client.stripeCustomerId,
  });

  const appUrl =
    (await getSetting("app.url")) ??
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3010";

  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${appUrl.replace(/\/$/, "")}/portal/billing?autopay=1`,
    cancel_url: `${appUrl.replace(/\/$/, "")}/portal/billing?autopay=cancelled`,
    metadata: {
      clientId,
      purpose: "autopay",
    },
  });

  return { url: session.url };
}

/** Turn off monthly autopay (card stays on the Stripe customer but is no longer charged). */
export async function disableAutopay() {
  const user = await requireClient();
  const clientId = user.clientId!;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      autopayEnabled: false,
      autopayEnabledAt: null,
      // keep stripePaymentMethodId so re-enabling is easier via a new setup
    },
  });

  await logActivity({
    actorId: user.id,
    clientId,
    action: "billing.autopay_disabled",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath("/portal/billing");
}

export async function updateAutopayDay(formData: FormData) {
  const user = await requireClient();
  const clientId = user.clientId!;
  const day = parseInt(String(formData.get("autopayDay") ?? "1"), 10);

  if (isNaN(day) || day < 1 || day > 28) {
    throw new Error("Choose a day between 1 and 28");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.autopayEnabled) {
    throw new Error("Enable Autopay before setting a billing day");
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { autopayDay: day },
  });

  revalidatePath("/portal/billing");
}
