import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
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
        description={client?.companyName}
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
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/billing">View all</Link>
            </Button>
          }
          accent="none"
        >
          {unpaidInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {unpaidInvoices.map((inv) => (
                <div key={inv.id} className="flex justify-between py-3 text-sm first:pt-0 last:pb-0">
                  <span>{inv.title}</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(inv.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Project updates"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/projects">View all</Link>
            </Button>
          }
          accent="none"
        >
          {visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <div className="space-y-4">
              {visibleTasks.map((t) => (
                <div key={t.id} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-muted-foreground">
                    Due {formatDate(t.dueDate)} · {t.status.replace(/_/g, " ")}
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
