import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  updateClientProfile,
  addClientNote,
  assignStaffToClient,
  unassignStaffFromClient,
} from "@/actions/clients";
import { formatDate, formatCurrency } from "@/lib/utils";
import { InvoiceStatusBadge, ClientTierBadge } from "@/components/shared/status-badge";
import { UserRole } from "@prisma/client";
import { selectClassName } from "@/lib/ui";
import { Building2, StickyNote, Receipt, Users } from "lucide-react";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!(await canAccessClient(user, id))) notFound();

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: true,
      invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
      clientNotes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
      staffAssignments: { include: { staff: { include: { user: true } } } },
    },
  });

  if (!client) notFound();

  const assignedStaffIds = new Set(
    client.staffAssignments.map((a) => a.staffId)
  );
  const availableStaff =
    user.role === UserRole.ADMIN
      ? await prisma.staffProfile.findMany({
          where: {
            user: { deletedAt: null, role: { in: [UserRole.STAFF, UserRole.ADMIN] } },
          },
          include: { user: { select: { name: true, email: true, role: true } } },
          orderBy: { user: { name: "asc" } },
        })
      : [];
  const unassignedStaff = availableStaff.filter((s) => !assignedStaffIds.has(s.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.companyName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {client.autopayEnabled
                ? `${client.user.email} · Monthly Autopay on (day ${client.autopayDay})`
                : client.user.email}
            </span>
            <ClientTierBadge tier={client.tier} />
          </span>
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/clients/${client.id}/insights`}>Insights</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/clients">← Clients</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile" description="Client contact and company details" icon={Building2} accent="secondary">
          <form action={updateClientProfile} className="space-y-4">
            <input type="hidden" name="clientId" value={client.id} />
            <div className="space-y-2">
              <Label>Company</Label>
              <Input name="companyName" defaultValue={client.companyName} required />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input name="contactName" defaultValue={client.contactName ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={client.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea name="address" defaultValue={client.address ?? ""} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-tier">Tier</Label>
              <select
                id="client-tier"
                name="tier"
                className={selectClassName}
                defaultValue={client.tier ?? ""}
              >
                <option value="">None</option>
                <option value="PLATINUM">Platinum</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
              </select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Panel>

        <Panel title="Internal notes" description="Staff-only — not visible to client" icon={StickyNote}>
          <div className="space-y-4">
            <form action={addClientNote.bind(null, client.id)} className="space-y-2">
              <Textarea name="body" placeholder="Add a note..." required rows={2} />
              <Button type="submit" size="sm">
                Add note
              </Button>
            </form>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {client.clientNotes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author.name} · {formatDate(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {user.role === UserRole.ADMIN && (
          <Panel
            title="Assigned staff"
            description="Staff who can see this client in the admin hub"
            icon={Users}
            accent="none"
            className="lg:col-span-2"
          >
            <div className="space-y-4">
              {client.staffAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No staff assigned yet. Assign someone so they can work this account.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {client.staffAssignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {assignment.staff.user.name ?? assignment.staff.user.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.staff.title ?? assignment.staff.user.email}
                        </p>
                      </div>
                      <form action={unassignStaffFromClient}>
                        <input type="hidden" name="staffId" value={assignment.staffId} />
                        <input type="hidden" name="clientId" value={client.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Remove
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {unassignedStaff.length > 0 && (
                <form action={assignStaffToClient} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="clientId" value={client.id} />
                  <div className="min-w-[16rem] flex-1 space-y-2">
                    <Label htmlFor="assign-staff">Add staff</Label>
                    <select
                      id="assign-staff"
                      name="staffId"
                      required
                      className={selectClassName}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select staff
                      </option>
                      {unassignedStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.user.name ?? staff.user.email}
                          {staff.user.role === UserRole.ADMIN ? " (Admin)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit">Assign</Button>
                </form>
              )}
            </div>
          </Panel>
        )}

        <Panel
          title="Recent invoices"
          description="Latest billing for this client"
          icon={Receipt}
          accent="none"
          className="lg:col-span-2"
        >
          <div className="divide-y divide-border/60">
            {client.invoices.map((inv) => (
              <div key={inv.id} className="flex justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
                <span>
                  {inv.invoiceNumber} — {inv.title}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="font-medium tabular-nums">
                    {formatCurrency(inv.amountCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
