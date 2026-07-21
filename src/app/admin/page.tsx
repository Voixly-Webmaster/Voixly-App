import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import {
  InvoiceStatusBadge,
  TicketStatusBadge,
} from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { UserRole, InvoiceStatus, TicketStatus } from "@prisma/client";
import {
  Users,
  CreditCard,
  MessageSquare,
  CheckSquare,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Inbox,
  ArrowUpRight,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const scope = await getStaffClientScope(user);
  const clientWhere =
    scope === "all" ? {} : { id: { in: scope.length ? scope : ["__none__"] } };
  const clientScope =
    scope === "all" ? {} : { clientId: { in: scope.length ? scope : ["__none__"] } };

  const [
    clientCount,
    unpaidCount,
    overdueCount,
    openTickets,
    activeTasks,
    completedToday,
    overdueInvoices,
    waitingTickets,
    recentActivity,
  ] = await Promise.all([
    prisma.client.count({ where: { ...clientWhere, deletedAt: null } }),
    prisma.invoice.count({
      where: {
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        ...clientScope,
      },
    }),
    prisma.invoice.count({
      where: {
        deletedAt: null,
        status: InvoiceStatus.OVERDUE,
        ...clientScope,
      },
    }),
    prisma.supportTicket.count({
      where: {
        deletedAt: null,
        status: { not: TicketStatus.RESOLVED },
        ...clientScope,
      },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        status: { notIn: ["COMPLETED", "ARCHIVED"] },
        ...clientScope,
      },
    }),
    prisma.task.count({
      where: {
        completed: true,
        deletedAt: null,
        updatedAt: { gte: startOfToday() },
        ...clientScope,
      },
    }),
    prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        ...clientScope,
      },
      include: { client: { select: { companyName: true } } },
      orderBy: [{ status: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
    prisma.supportTicket.findMany({
      where: {
        deletedAt: null,
        status: { not: TicketStatus.RESOLVED },
        ...clientScope,
      },
      include: { client: { select: { companyName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: scope === "all" ? {} : { clientId: { in: scope.length ? scope : ["__none__"] } },
      include: {
        actor: { select: { name: true, email: true } },
        client: { select: { companyName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          user.role === UserRole.ADMIN
            ? "Overview of all clients and operations"
            : "Your assigned clients and work"
        }
        action={
          <Button asChild>
            <Link href="/admin/tasks">
              <LayoutDashboard className="h-4 w-4" />
              Open tasks
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clients"
          value={clientCount}
          href="/admin/clients"
          icon={Users}
        />
        <StatCard
          label="Unpaid invoices"
          value={unpaidCount}
          href="/admin/invoices?status=SENT"
          icon={CreditCard}
          accent="secondary"
        />
        <StatCard
          label="Open tickets"
          value={openTickets}
          href="/admin/tickets?status=OPEN"
          icon={MessageSquare}
        />
        <StatCard
          label="Active tasks"
          value={activeTasks}
          href="/admin/tasks"
          icon={CheckSquare}
          accent="neutral"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Overdue invoices"
          value={overdueCount}
          icon={AlertTriangle}
          accent={overdueCount > 0 ? "warning" : "muted"}
          href="/admin/invoices?status=OVERDUE"
        />
        <MiniStat
          label="Waiting on client"
          value={
            waitingTickets.filter((t) => t.status === TicketStatus.WAITING).length
          }
          icon={Inbox}
          accent="muted"
          href="/admin/tickets?status=WAITING"
        />
        <MiniStat
          label="Tasks completed today"
          value={completedToday}
          icon={CheckSquare}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Overdue & unpaid"
          description="Invoices waiting on payment"
          icon={CreditCard}
          accent="primary"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/invoices">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {overdueInvoices.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="All caught up"
              description="No outstanding invoices."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {overdueInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {inv.client.companyName} — {inv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.invoiceNumber} · due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm font-medium">
                      {formatCurrency(inv.amountCents)}
                    </span>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Open conversations"
          description="Latest tickets needing attention"
          icon={MessageSquare}
          accent="secondary"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/tickets">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {waitingTickets.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No open tickets"
              description="You're all caught up on support."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {waitingTickets.map((t) => (
                <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="group flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-primary">
                        {t.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.client.companyName} · {formatRelativeTime(t.updatedAt)}
                      </p>
                    </div>
                    <TicketStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent activity"
        description="Last actions across your accounts"
        icon={Activity}
        accent="none"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/activity">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Actions you and your team take will appear here."
            className="py-8"
          />
        ) : (
          <ol className="space-y-3">
            {recentActivity.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-3 text-sm"
              >
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary/70" />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">
                      {log.actor?.name ?? log.actor?.email ?? "System"}
                    </span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {log.action}
                    </span>
                    {log.client?.companyName && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="text-muted-foreground">
                          {log.client.companyName}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(log.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function MiniStat({
  label,
  value,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: number;
  icon: typeof CheckSquare;
  accent: "muted" | "warning" | "success";
  href?: string;
}) {
  const accentClass =
    accent === "warning"
      ? "bg-warning-muted text-warning-foreground"
      : accent === "success"
        ? "bg-success-muted text-success-foreground"
        : "bg-muted text-muted-foreground";
  const content = (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm shadow-elevated transition-colors hover:bg-muted/30">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
