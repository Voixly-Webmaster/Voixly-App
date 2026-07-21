"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { cancelRecurringInvoice } from "@/actions/invoices";
import { Loader2 } from "lucide-react";

export function CancelRecurringButton({
  recurringInvoiceId,
  title,
}: {
  recurringInvoiceId: string;
  title: string;
}) {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Cancel “${title}”?`,
          description:
            "Future automatic charges will stop. Past invoices and payments are kept.",
          confirmLabel: "Cancel subscription",
          tone: "destructive",
        });
        if (!ok) return;
        startTransition(async () => {
          try {
            await cancelRecurringInvoice(recurringInvoiceId);
            success("Recurring charge cancelled");
          } catch (err) {
            error(
              "Could not cancel",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      Cancel
    </Button>
  );
}
