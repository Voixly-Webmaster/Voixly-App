"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { selectClassName } from "@/lib/ui";
import { createInvoice } from "@/actions/invoices";
import { useToast } from "@/components/providers/toast-provider";
import { Loader2 } from "lucide-react";

type ClientOption = { id: string; companyName: string };

export function CreateInvoiceForm({ clients }: { clients: ClientOption[] }) {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [recurring, setRecurring] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await createInvoice(formData);
            success(
              recurring ? "Recurring invoice created" : "Invoice sent",
              recurring
                ? "Client will subscribe and be charged automatically each period."
                : undefined
            );
            formRef.current?.reset();
            setRecurring(false);
          } catch (err) {
            error(
              "Could not create invoice",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="inv-client">Client</Label>
        <select
          id="inv-client"
          name="clientId"
          required
          className={selectClassName}
        >
          <option value="">Select client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-title">Title</Label>
        <Input
          id="inv-title"
          name="title"
          required
          placeholder="Monthly retainer"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-amount">Amount (USD)</Label>
        <Input
          id="inv-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-due">Due date</Label>
        <Input id="inv-due" name="dueDate" type="date" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="inv-description">Description</Label>
        <Input id="inv-description" name="description" />
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:col-span-2 lg:col-span-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="recurring"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <span>
            <span className="font-medium text-foreground">Recurring charge</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Client pays once to start a Stripe subscription. Stripe bills them
              automatically on the schedule you choose.
            </span>
          </span>
        </label>
        {recurring && (
          <div className="max-w-xs space-y-2 pl-6">
            <Label htmlFor="inv-interval">Billing interval</Label>
            <select
              id="inv-interval"
              name="interval"
              required
              className={selectClassName}
              defaultValue="MONTHLY"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {recurring ? "Create recurring invoice" : "Send invoice"}
        </Button>
      </div>
    </form>
  );
}
