import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { replyToTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, deletedAt: null },
    select: { subject: true },
  });
  return { title: ticket?.subject ?? "Ticket" };
}

export default async function PortalTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, clientId: user.clientId!, deletedAt: null },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!ticket) notFound();

  const sendReply = replyToTicket.bind(null, ticket.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.subject}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/support">← Back</Link>
          </Button>
        }
      />
      <Panel accent="none" noPadding>
        <div className="px-5 py-4">
          <TicketStatusBadge status={ticket.status} />
        </div>
      </Panel>
      <TicketThread messages={ticket.messages} sendAction={sendReply} />
    </div>
  );
}
