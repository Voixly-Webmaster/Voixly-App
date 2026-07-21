import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { FormPanel } from "@/components/shared/form-panel";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createTicket } from "@/actions/tickets";
import { formatDate } from "@/lib/utils";
import { MessageSquarePlus } from "lucide-react";

export default async function PortalSupportPage() {
  const user = await requireClient();

  const tickets = await prisma.supportTicket.findMany({
    where: { clientId: user.clientId!, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Open a ticket or continue an existing conversation"
      />

      <FormPanel
        title="New ticket"
        description="We typically respond within one business day"
        icon={MessageSquarePlus}
      >
        <form action={createTicket} className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required placeholder="How can we help?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" required rows={4} />
          </div>
          <Button type="submit">Submit ticket</Button>
        </form>
      </FormPanel>

      <DataTable headers={["Subject", "Status", "Updated", "Messages", ""]}>
        {tickets.map((t) => (
          <DataTableRow key={t.id}>
            <DataTableCell className="font-medium">{t.subject}</DataTableCell>
            <DataTableCell>
              <TicketStatusBadge status={t.status} />
            </DataTableCell>
            <DataTableCell>{formatDate(t.updatedAt)}</DataTableCell>
            <DataTableCell>{t._count.messages}</DataTableCell>
            <DataTableCell className="text-right">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/portal/support/${t.id}`}>Open</Link>
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
