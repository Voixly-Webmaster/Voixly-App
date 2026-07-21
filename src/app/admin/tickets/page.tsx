import Link from "next/link";
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
import { TicketStatusBadge } from "@/components/shared/status-badge";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  parsePageParam,
} from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { TicketStatus } from "@prisma/client";

const TICKET_STATUS_OPTIONS = [
  { value: TicketStatus.OPEN, label: "Open" },
  { value: TicketStatus.WAITING, label: "Waiting" },
  { value: TicketStatus.RESOLVED, label: "Resolved" },
];

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireAdmin();
  const { q, status, page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const scope = await getStaffClientScope(user);

  const where = {
    deletedAt: null,
    ...(scope !== "all" ? { clientId: { in: scope.length ? scope : ["__none__"] } } : {}),
    ...(status ? { status: status as TicketStatus } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { client: { companyName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      include: { client: true, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support tickets"
        description="Client conversations and ticket status"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              paramName="status"
              placeholder="All statuses"
              ariaLabel="Filter by status"
              options={TICKET_STATUS_OPTIONS}
            />
            <SearchInput placeholder="Search tickets..." />
          </div>
        }
      />

      <DataTable headers={["Subject", "Client", "Status", "Updated", "Msgs", ""]}>
        {tickets.map((t) => (
          <DataTableRow key={t.id}>
            <DataTableCell className="font-medium">{t.subject}</DataTableCell>
            <DataTableCell>{t.client.companyName}</DataTableCell>
            <DataTableCell>
              <TicketStatusBadge status={t.status} />
            </DataTableCell>
            <DataTableCell className="text-muted-foreground">
              {formatRelativeTime(t.updatedAt)}
            </DataTableCell>
            <DataTableCell className="tabular-nums">{t._count.messages}</DataTableCell>
            <DataTableCell className="text-right">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/tickets/${t.id}`}>Open</Link>
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      <Pagination
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        totalItems={total}
        pathname="/admin/tickets"
        searchParams={{ q, status }}
      />
    </div>
  );
}
