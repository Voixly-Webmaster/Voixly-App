import {
  BillingInterval,
  type RecurringStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";

export function parseBillingInterval(value: unknown): BillingInterval | null {
  if (value === "WEEKLY" || value === "MONTHLY" || value === "YEARLY") {
    return value;
  }
  return null;
}

export function toStripeInterval(
  interval: BillingInterval
): Stripe.PriceCreateParams.Recurring.Interval {
  switch (interval) {
    case BillingInterval.WEEKLY:
      return "week";
    case BillingInterval.YEARLY:
      return "year";
    default:
      return "month";
  }
}

export function intervalLabel(interval: BillingInterval): string {
  switch (interval) {
    case BillingInterval.WEEKLY:
      return "weekly";
    case BillingInterval.YEARLY:
      return "yearly";
    default:
      return "monthly";
  }
}

export function recurringStatusLabel(status: RecurringStatus): string {
  switch (status) {
    case "PENDING":
      return "Awaiting first payment";
    case "ACTIVE":
      return "Active";
    case "PAUSED":
      return "Paused";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

/** Atomically pick the next invoice number (unique + retry). */
export async function generateInvoiceNumber(): Promise<string> {
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
