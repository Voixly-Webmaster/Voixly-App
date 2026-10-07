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
import { selectClassName } from "@/lib/ui";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  parsePageParam,
} from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/actions/clients";
import { ClientTier, UserRole } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { UserPlus, Users } from "lucide-react";
import { PendingSubmit } from "@/components/shared/pending-submit";

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
          description="Create a new client portal login"
          icon={UserPlus}
        >
          <form
            action={createClient}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="new-client-company">Company</Label>
              <Input id="new-client-company" name="companyName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-contact">Contact name</Label>
              <Input id="new-client-contact" name="contactName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-email">Email</Label>
              <Input id="new-client-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-phone">Phone</Label>
              <Input id="new-client-phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-password">Password</Label>
              <Input
                id="new-client-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-tier">Tier</Label>
              <select
                id="new-client-tier"
                name="tier"
                className={selectClassName}
                defaultValue=""
              >
                <option value="">None</option>
                <option value="PLATINUM">Platinum</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <PendingSubmit pendingLabel="Creating…">Create client</PendingSubmit>
            </div>
          </form>
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
