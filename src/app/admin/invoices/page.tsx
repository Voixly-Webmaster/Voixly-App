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
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  parsePageParam,
} from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createInvoice } from "@/actions/invoices";
import { formatCurrency, formatDate } from "@/lib/utils";
import { selectClassName } from "@/lib/ui";
import { InvoiceStatus, UserRole } from "@prisma/client";
import { FileText } from "lucide-react";

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

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(scope !== "all" ? { id: { in: scope.length ? scope : ["__none__"] } } : {}),
    },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  const where = {
    deletedAt: null,
    ...(scope !== "all" ? { clientId: { in: scope.length ? scope : ["__none__"] } } : {}),
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

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Billing, payment status, and overdue tracking"
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
          description="Bill a client and send for payment"
          icon={FileText}
        >
          <form action={createInvoice} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inv-client">Client</Label>
              <select
                id="inv-client"
                name="clientId"
                required
                className={selectClassName}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-title">Title</Label>
              <Input id="inv-title" name="title" required placeholder="Monthly retainer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-amount">Amount (USD)</Label>
              <Input
                id="inv-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-due">Due date</Label>
              <Input id="inv-due" name="dueDate" type="date" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inv-description">Description</Label>
              <Input id="inv-description" name="description" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Send invoice</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable headers={["Invoice", "Client", "Due", "Amount", "Status"]}>
        {invoices.map((inv) => (
          <DataTableRow key={inv.id}>
            <DataTableCell>
              <p className="font-medium">{inv.invoiceNumber}</p>
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
