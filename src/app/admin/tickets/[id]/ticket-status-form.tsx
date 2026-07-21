"use client";

import { TicketStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { updateTicketStatus } from "@/actions/tickets";

export function TicketStatusForm({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
}) {
  const statuses: { value: TicketStatus; label: string }[] = [
    { value: TicketStatus.OPEN, label: "Open" },
    { value: TicketStatus.WAITING, label: "Waiting" },
    { value: TicketStatus.RESOLVED, label: "Resolved" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <Button
          key={s.value}
          type="button"
          variant={currentStatus === s.value ? "default" : "outline"}
          size="sm"
          onClick={() => updateTicketStatus(ticketId, s.value)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
