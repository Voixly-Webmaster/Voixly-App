import Stripe from "stripe";
import { getSetting } from "@/lib/settings";

let cached: { key: string; client: Stripe } | null = null;

export async function getStripe(): Promise<Stripe> {
  const key = await getSetting("stripe.secretKey");
  if (!key) {
    throw new Error(
      "Stripe secret key is not set. Add it in Admin → Settings → Payments or set STRIPE_SECRET_KEY."
    );
  }
  if (!cached || cached.key !== key) {
    cached = { key, client: new Stripe(key, { typescript: true }) };
  }
  return cached.client;
}

export async function getStripePublishableKey(): Promise<string> {
  return (await getSetting("stripe.publishableKey")) ?? "";
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return getSetting("stripe.webhookSecret");
}

export async function isStripeConfigured(): Promise<boolean> {
  return Boolean(await getSetting("stripe.secretKey"));
}
