import { Badge } from "@/components/ui/badge";

const taskStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" | "destructive" }> = {
  NEW: { label: "Not Started", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  WAITING_ON_CLIENT: { label: "Waiting on Client", variant: "warning" },
  STUCK: { label: "Stuck", variant: "destructive" },
  SEND_TO_CLIENT: { label: "Send to Client", variant: "default" },
  COMPLETED: { label: "Complete", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

const ticketStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
  OPEN: { label: "Open", variant: "default" },
  WAITING: { label: "Waiting", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
};

const invoiceStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  DRAFT: { label: "Draft", variant: "outline" as "secondary" },
  SENT: { label: "Unpaid", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
  VOID: { label: "Void", variant: "secondary" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const cfg = taskStatusMap[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function TicketStatusBadge({ status }: { status: string }) {
  const cfg = ticketStatusMap[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = invoiceStatusMap[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const tierMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }
> = {
  PLATINUM: { label: "Platinum", variant: "default" },
  GOLD: { label: "Gold", variant: "warning" },
  SILVER: { label: "Silver", variant: "secondary" },
  BRONZE: { label: "Bronze", variant: "outline" },
};

export function ClientTierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  const cfg = tierMap[tier] ?? { label: tier, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
