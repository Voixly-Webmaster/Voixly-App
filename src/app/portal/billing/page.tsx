import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { AlertBanner } from "@/components/shared/alert-banner";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { PayNowButton } from "@/components/billing/pay-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatus } from "@prisma/client";
import { Wallet } from "lucide-react";

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const user = await requireClient();
  const params = await searchParams;
  const clientId = user.clientId!;

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { invoice: true },
    }),
  ]);

  const unpaidStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE];
  const balanceDue = invoices
    .filter((i) => unpaidStatuses.includes(i.status))
    .reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="View invoices, pay online, and review payment history"
      />

      {params.paid === "1" && (
        <AlertBanner>
          Payment received — thank you! Your invoice will update shortly.
        </AlertBanner>
      )}

      <StatCard
        label="Account balance"
        value={formatCurrency(balanceDue)}
        icon={Wallet}
        accent="primary"
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Invoices</h2>
        <DataTable headers={["Invoice", "Due", "Amount", "Status", ""]}>
          {invoices.map((inv) => (
            <DataTableRow key={inv.id}>
              <DataTableCell>
                <p className="font-medium">{inv.title}</p>
                <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
              </DataTableCell>
              <DataTableCell>{formatDate(inv.dueDate)}</DataTableCell>
              <DataTableCell>{formatCurrency(inv.amountCents)}</DataTableCell>
              <DataTableCell>
                <InvoiceStatusBadge status={inv.status} />
              </DataTableCell>
              <DataTableCell className="text-right">
                {unpaidStatuses.includes(inv.status) && <PayNowButton invoiceId={inv.id} />}
              </DataTableCell>
            </DataTableRow>
          ))}
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
