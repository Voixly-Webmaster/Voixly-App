"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { selectClassName } from "@/lib/ui";
import { sendTextToClient } from "@/actions/texts";

export function SendTextForm({
  customers,
  defaultClientId,
}: {
  customers: { id: string; label: string }[];
  defaultClientId?: string;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(defaultClientId || customers[0]?.id || "");
  const locked = Boolean(defaultClientId);

  if (customers.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers to text yet.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const message = String(new FormData(event.currentTarget).get("body") ?? "");
        const form = event.currentTarget;
        startTransition(async () => {
          try {
            const result = await sendTextToClient(clientId, message);
            if ("error" in result) {
              error("Could not send the text", result.error);
              return;
            }
            form.reset();
            success("Text sent", "It is in their thread.");
            router.push(`/admin/texts/${result.conversationId}`);
            router.refresh();
          } catch (err) {
            error("Could not send the text", actionErrorMessage(err));
          }
        });
      }}
    >
      {!locked && (
        <div className="space-y-2">
          <Label htmlFor="text-customer">Customer</Label>
          <select
            id="text-customer"
            className={selectClassName}
            value={clientId}
            disabled={pending}
            onChange={(event) => setClientId(event.target.value)}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="text-body">Message</Label>
        <Textarea
          id="text-body"
          name="body"
          required
          maxLength={1000}
          rows={3}
          disabled={pending}
          placeholder="Write the text to send from your Voixly number"
        />
      </div>
      <Button type="submit" disabled={pending || !clientId}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        Send text
      </Button>
    </form>
  );
}
