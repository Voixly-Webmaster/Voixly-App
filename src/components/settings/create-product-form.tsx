"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { selectClassName } from "@/lib/ui";
import { createProduct } from "@/actions/products";
import { Check, Loader2 } from "lucide-react";

export function CreateProductForm() {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [justAdded, setJustAdded] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const form = e.currentTarget;
        const formData = new FormData(form);
        const name = String(formData.get("name") ?? "").trim();
        startTransition(async () => {
          try {
            await createProduct(formData);
            form.reset();
            setJustAdded(true);
            window.setTimeout(() => setJustAdded(false), 2200);
            success("Product added", name ? `${name} is ready to bill.` : undefined);
          } catch (err) {
            error(
              "Could not add product",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          name="name"
          required
          placeholder="SEO retainer"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="product-amount">Amount (USD)</Label>
        <Input
          id="product-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="product-interval">Interval</Label>
        <select
          id="product-interval"
          name="interval"
          className={selectClassName}
          defaultValue="MONTHLY"
          disabled={pending}
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="product-description">Description</Label>
        <Input id="product-description" name="description" disabled={pending} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending || justAdded}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : justAdded ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : null}
          {pending ? "Adding…" : justAdded ? "Added" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
