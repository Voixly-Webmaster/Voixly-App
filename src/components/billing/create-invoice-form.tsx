"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { selectClassName } from "@/lib/ui";
import { createInvoice } from "@/actions/invoices";
import { useToast } from "@/components/providers/toast-provider";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { BillingInterval } from "@prisma/client";

type ClientOption = { id: string; companyName: string };

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  interval: BillingInterval;
};

export function CreateInvoiceForm({
  clients,
  products,
}: {
  clients: ClientOption[];
  products: CatalogProduct[];
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [productId, setProductId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [recurring, setRecurring] = React.useState(false);
  const [interval, setInterval] = React.useState<BillingInterval>("MONTHLY");
  const formRef = React.useRef<HTMLFormElement>(null);

  function applyProduct(id: string) {
    setProductId(id);
    if (!id) return;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setTitle(product.name);
    setAmount((product.amountCents / 100).toFixed(2));
    setDescription(product.description ?? "");
    setRecurring(true);
    setInterval(product.interval);
  }

  function resetForm() {
    formRef.current?.reset();
    setProductId("");
    setTitle("");
    setAmount("");
    setDescription("");
    setRecurring(false);
    setInterval("MONTHLY");
  }

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
            resetForm();
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
        <Label htmlFor="inv-product">Product</Label>
        <select
          id="inv-product"
          name="productId"
          className={selectClassName}
          value={productId}
          onChange={(e) => applyProduct(e.target.value)}
        >
          <option value="">Custom</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatCurrency(p.amountCents)}/{p.interval.toLowerCase()}
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-due">Due date</Label>
        <Input id="inv-due" name="dueDate" type="date" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="inv-description">Description</Label>
        <Input
          id="inv-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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
              value={interval}
              onChange={(e) => setInterval(e.target.value as BillingInterval)}
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
