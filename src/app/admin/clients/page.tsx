import type { Metadata } from "next";
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
import { FormPanel } from "@/components/shared/form-panel";
import { ClientTierBadge } from "@/components/shared/status-badge";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  parsePageParam,
} from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { CreateClientForm } from "@/components/clients/create-client-form";
import { ClientTier, UserRole } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { UserPlus, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Clients",
  description: "Manage client companies, contacts, tiers, and assignments.",
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tier?: string }>;
}) {
  const user = await requireAdmin();
  const { q, page: pageParam, tier } = await searchParams;
  const page = parsePageParam(pageParam);
  const scope = await getStaffClientScope(user);
  const tierFilter =
    tier === "PLATINUM" || tier === "GOLD" || tier === "SILVER" || tier === "BRONZE"
      ? (tier as ClientTier)
      : undefined;

  const where = {
    deletedAt: null,
    ...(scope !== "all" ? { id: { in: scope.length ? scope : ["__none__"] } } : {}),
    ...(tierFilter ? { tier: tierFilter } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q } },
            { contactName: { contains: q } },
            { user: { email: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      include: { user: true },
      orderBy: { companyName: "asc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage client accounts and profiles"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              paramName="tier"
              placeholder="All tiers"
              ariaLabel="Filter by tier"
              options={[
                { value: "PLATINUM", label: "Platinum" },
                { value: "GOLD", label: "Gold" },
                { value: "SILVER", label: "Silver" },
                { value: "BRONZE", label: "Bronze" },
              ]}
            />
            <SearchInput placeholder="Search clients..." />
          </div>
        }
      />

      {user.role === UserRole.STAFF && scope !== "all" && scope.length === 0 && (
        <EmptyState
          icon={Users}
          title="No clients assigned yet"
          description="Ask an admin to assign you to a client so their accounts appear here."
        />
      )}

      {user.role === UserRole.ADMIN && (
        <FormPanel
          title="Add client"
          description="Creates a portal login and sends a welcome email"
          icon={UserPlus}
        >
          <CreateClientForm />
        </FormPanel>
      )}

      <DataTable headers={["Company", "Tier", "Contact", "Email", "Since", ""]}>
        {clients.map((c) => (
          <DataTableRow key={c.id}>
            <DataTableCell className="font-medium">{c.companyName}</DataTableCell>
            <DataTableCell>
              <ClientTierBadge tier={c.tier} />
            </DataTableCell>
            <DataTableCell>{c.contactName ?? "—"}</DataTableCell>
            <DataTableCell>{c.user.email}</DataTableCell>
            <DataTableCell>{formatDate(c.createdAt)}</DataTableCell>
            <DataTableCell className="text-right">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/clients/${c.id}`}>View</Link>
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      <Pagination
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        totalItems={total}
        pathname="/admin/clients"
        searchParams={{ q, tier }}
      />
    </div>
  );
}
