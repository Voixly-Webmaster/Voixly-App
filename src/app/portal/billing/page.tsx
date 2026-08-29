import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { AlertBanner } from "@/components/shared/alert-banner";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { PayNowButton } from "@/components/billing/pay-button";
import { AutopayPanel } from "@/components/billing/autopay-panel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { intervalLabel, recurringStatusLabel } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { InvoiceStatus } from "@prisma/client";
import { Wallet } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Billing",
  description: "View invoices, pay balances, and manage autopay.",
};

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; autopay?: string }>;
}) {
  const user = await requireClient();
  const params = await searchParams;
  const clientId = user.clientId!;

  const [client, invoices, payments, recurring] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.invoice.findMany({
      where: { clientId, deletedAt: null },
      include: {
        recurringInvoice: {
          select: { id: true, interval: true, status: true, stripeSubscriptionId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { invoice: true },
    }),
    prisma.recurringInvoice.findMany({
      where: {
        clientId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let cardHint: string | null = null;
  if (client?.stripePaymentMethodId) {
    try {
      const stripe = await getStripe();
      const pm = await stripe.paymentMethods.retrieve(client.stripePaymentMethodId);
      if (pm.card) {
        cardHint = `${pm.card.brand?.toUpperCase() ?? "Card"} •••• ${pm.card.last4}`;
      }
    } catch {
      // Stripe key missing or PM deleted — panel still works
    }
  }

  const unpaidStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE];
  const balanceDue = invoices
    .filter((i) => unpaidStatuses.includes(i.status))
    .reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Pay invoices, manage Autopay, and review payment history"
      />

      {params.paid === "1" && (
        <AlertBanner>
          Payment received — thank you! Your invoice will update shortly.
        </AlertBanner>
      )}

      {params.autopay === "1" && (
        <AlertBanner>
          Monthly Autopay is on. Open invoices will be charged automatically.
        </AlertBanner>
      )}

      {params.autopay === "cancelled" && (
        <AlertBanner variant="warning">
          Autopay setup was cancelled. You can try again anytime.
        </AlertBanner>
      )}

      <StatCard
        label="Account balance"
        value={formatCurrency(balanceDue)}
        icon={Wallet}
        accent="primary"
      />

      <AutopayPanel
        enabled={Boolean(client?.autopayEnabled)}
        autopayDay={client?.autopayDay ?? 1}
        cardHint={cardHint}
      />

      {recurring.length > 0 && (
        <Panel
          title="Your subscriptions"
          description="Automatic charges after you subscribe"
          accent="secondary"
        >
          <DataTable headers={["Plan", "Amount", "Interval", "Status", "Next bill"]}>
            {recurring.map((r) => (
              <DataTableRow key={r.id}>
                <DataTableCell className="font-medium">{r.title}</DataTableCell>
                <DataTableCell>{formatCurrency(r.amountCents)}</DataTableCell>
                <DataTableCell className="capitalize">
                  {intervalLabel(r.interval)}
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                    {recurringStatusLabel(r.status)}
                  </Badge>
                </DataTableCell>
                <DataTableCell>
                  {r.status === "PENDING" ? "After first payment" : formatDate(r.nextBillingAt)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </Panel>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Invoices</h2>
        <DataTable headers={["Invoice", "Due", "Amount", "Status", ""]}>
          {invoices.map((inv) => {
            const needsSubscribe =
              unpaidStatuses.includes(inv.status) &&
              !!inv.recurringInvoice &&
              !inv.recurringInvoice.stripeSubscriptionId &&
              inv.recurringInvoice.status !== "CANCELLED";

            return (
              <DataTableRow key={inv.id}>
                <DataTableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{inv.title}</p>
                    {inv.recurringInvoice && (
                      <Badge variant="outline" className="text-[10px]">
                        {intervalLabel(inv.recurringInvoice.interval)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                </DataTableCell>
                <DataTableCell>{formatDate(inv.dueDate)}</DataTableCell>
                <DataTableCell>{formatCurrency(inv.amountCents)}</DataTableCell>
                <DataTableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </DataTableCell>
                <DataTableCell className="text-right">
                  {unpaidStatuses.includes(inv.status) && (
                    <PayNowButton invoiceId={inv.id} recurring={needsSubscribe} />
                  )}
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Payment history</h2>
        <DataTable headers={["Date", "Invoice", "Amount", "Status"]}>
          {payments.map((p) => (
            <DataTableRow key={p.id}>
              <DataTableCell>{formatDate(p.paidAt ?? p.createdAt)}</DataTableCell>
              <DataTableCell>{p.invoice?.invoiceNumber ?? "—"}</DataTableCell>
              <DataTableCell>{formatCurrency(p.amountCents)}</DataTableCell>
              <DataTableCell className="capitalize">{p.status.toLowerCase()}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
