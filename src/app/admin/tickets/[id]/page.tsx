import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { replyToTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { Panel } from "@/components/shared/panel";
import { TicketStatusForm } from "./ticket-status-form";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!ticket) notFound();
  if (!(await canAccessClient(user, ticket.clientId))) notFound();

  const sendReply = replyToTicket.bind(null, ticket.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.subject}
        description={ticket.client.companyName}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/tickets">← Tickets</Link>
          </Button>
        }
      />

      <Panel accent="none" noPadding>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <TicketStatusBadge status={ticket.status} />
          <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
        </div>
      </Panel>

      <TicketThread messages={ticket.messages} sendAction={sendReply} />
    </div>
  );
}
