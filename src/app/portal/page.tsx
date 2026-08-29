import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatus, TicketStatus } from "@prisma/client";
import { CreditCard, MessageSquare, FolderKanban, Megaphone } from "lucide-react";

export default async function PortalDashboardPage() {
  const user = await requireClient();
  const clientId = user.clientId!;

  const [client, unpaidInvoices, openTickets, visibleTasks, announcements] =
    await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.invoice.findMany({
        where: {
          clientId,
          deletedAt: null,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
      prisma.supportTicket.count({
        where: { clientId, deletedAt: null, status: { not: TicketStatus.RESOLVED } },
      }),
      prisma.task.findMany({
        where: { clientId, clientVisible: true, deletedAt: null, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.announcement.findMany({
        where: { published: true, deletedAt: null },
        orderBy: { publishAt: "desc" },
        take: 2,
      }),
    ]);

  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${client?.contactName ? `, ${client.contactName}` : ""}`}
        description={
          client?.companyName
            ? `Your ${client.companyName} workspace`
            : "Your client workspace"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Balance due"
          value={formatCurrency(unpaidTotal)}
          href="/portal/billing"
          icon={CreditCard}
        />
        <StatCard
          label="Open tickets"
          value={openTickets}
          href="/portal/support"
          icon={MessageSquare}
          accent="secondary"
        />
        <StatCard
          label="Active projects"
          value={visibleTasks.length}
          href="/portal/projects"
          icon={FolderKanban}
        />
        <StatCard
          label="Announcements"
          value={announcements.length}
          href="/portal/announcements"
          icon={Megaphone}
          accent="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Unpaid invoices"
          description="Bills waiting on payment"
          accent="primary"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/billing">View all</Link>
            </Button>
          }
        >
          {unpaidInvoices.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="You're all caught up"
              description="No invoices are due right now."
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {unpaidInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(inv.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Project updates"
          description="Work your team has shared with you"
          accent="secondary"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/projects">View all</Link>
            </Button>
          }
        >
          {visibleTasks.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No project updates yet"
              description="When your team shares work, it will show up here."
              className="py-8"
            />
          ) : (
            <div className="space-y-4">
              {visibleTasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(t.dueDate)}
                    </p>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Latest announcements"
          description="Notes from your Voixly team"
          icon={Megaphone}
          accent="none"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/announcements">View all</Link>
            </Button>
          }
        >
          {announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements"
              description="We'll post updates here when there's something to share."
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {announcements.map((a) => (
                <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
