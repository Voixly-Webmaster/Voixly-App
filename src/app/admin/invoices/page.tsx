import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { FormPanel } from "@/components/shared/form-panel";
import { Panel } from "@/components/shared/panel";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  parsePageParam,
} from "@/components/shared/pagination";
import { CreateInvoiceForm } from "@/components/billing/create-invoice-form";
import { CancelRecurringButton } from "@/components/billing/cancel-recurring-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { intervalLabel, recurringStatusLabel } from "@/lib/billing";
import { InvoiceStatus, RecurringStatus, UserRole } from "@prisma/client";
import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Create, send, and track client invoices and recurring billing.",
};

const INVOICE_STATUS_OPTIONS = [
  { value: InvoiceStatus.DRAFT, label: "Draft" },
  { value: InvoiceStatus.SENT, label: "Unpaid" },
  { value: InvoiceStatus.PAID, label: "Paid" },
  { value: InvoiceStatus.OVERDUE, label: "Overdue" },
  { value: InvoiceStatus.VOID, label: "Void" },
  { value: InvoiceStatus.FAILED, label: "Failed" },
];

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireAdmin();
  const { q, status, page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const scope = await getStaffClientScope(user);

  const clientScope =
    scope !== "all"
      ? { clientId: { in: scope.length ? scope : ["__none__"] } }
      : {};

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(scope !== "all"
        ? { id: { in: scope.length ? scope : ["__none__"] } }
        : {}),
    },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  const where = {
    deletedAt: null,
    ...clientScope,
    ...(status ? { status: status as InvoiceStatus } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q } },
            { title: { contains: q } },
            { client: { companyName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, invoices, recurring, products] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        client: true,
        recurringInvoice: { select: { id: true, interval: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.recurringInvoice.findMany({
      where: {
        ...clientScope,
        status: { in: [RecurringStatus.PENDING, RecurringStatus.ACTIVE, RecurringStatus.PAUSED] },
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        amountCents: true,
        interval: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="One-time bills and automatic recurring charges"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              paramName="status"
              placeholder="All statuses"
              ariaLabel="Filter by status"
              options={INVOICE_STATUS_OPTIONS}
            />
            <SearchInput placeholder="Search invoices..." />
          </div>
        }
      />

      {user.role === UserRole.ADMIN && (
        <FormPanel
          title="Create invoice"
          description="Bill once, or set up a recurring Stripe subscription"
          icon={FileText}
        >
          <CreateInvoiceForm clients={clients} products={products} />
        </FormPanel>
      )}

      {recurring.length > 0 && (
        <Panel
          title="Recurring charges"
          description="Active and pending subscriptions"
          icon={RefreshCw}
          accent="secondary"
        >
          <DataTable
            headers={["Plan", "Client", "Amount", "Interval", "Status", "Next bill", ""]}
            emptyMessage="No recurring charges."
          >
            {recurring.map((r) => (
              <DataTableRow key={r.id}>
                <DataTableCell>
                  <p className="font-medium">{r.title}</p>
                </DataTableCell>
                <DataTableCell>{r.client.companyName}</DataTableCell>
                <DataTableCell className="tabular-nums">
                  {formatCurrency(r.amountCents)}
                </DataTableCell>
                <DataTableCell className="capitalize">
                  {intervalLabel(r.interval)}
                </DataTableCell>
                <DataTableCell>
                  <Badge
                    variant={
                      r.status === "ACTIVE"
                        ? "success"
                        : r.status === "PAUSED"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {recurringStatusLabel(r.status)}
                  </Badge>
                </DataTableCell>
                <DataTableCell>
                  {r.status === "PENDING"
                    ? "—"
                    : formatDate(r.nextBillingAt)}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {user.role === UserRole.ADMIN && (
                    <CancelRecurringButton
                      recurringInvoiceId={r.id}
                      title={r.title}
                    />
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </Panel>
      )}

      <DataTable headers={["Invoice", "Client", "Due", "Amount", "Status"]}>
        {invoices.map((inv) => (
          <DataTableRow key={inv.id}>
            <DataTableCell>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{inv.invoiceNumber}</p>
                {inv.recurringInvoice && (
                  <Badge variant="outline" className="text-[10px]">
                    {intervalLabel(inv.recurringInvoice.interval)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{inv.title}</p>
            </DataTableCell>
            <DataTableCell>{inv.client.companyName}</DataTableCell>
            <DataTableCell>{formatDate(inv.dueDate)}</DataTableCell>
            <DataTableCell className="tabular-nums">
              {formatCurrency(inv.amountCents)}
            </DataTableCell>
            <DataTableCell>
              <InvoiceStatusBadge status={inv.status} />
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      <Pagination
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        totalItems={total}
        pathname="/admin/invoices"
        searchParams={{ q, status }}
      />
    </div>
  );
}
