"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { selectClassName } from "@/lib/ui";
import {
  deleteProduct,
  setProductActive,
  updateProduct,
} from "@/actions/products";
import { Check, Loader2, Trash2 } from "lucide-react";

type Interval = "WEEKLY" | "MONTHLY" | "YEARLY";

export function ProductEditForm({
  id,
  name,
  description,
  amount,
  interval,
}: {
  id: string;
  name: string;
  description: string;
  amount: string;
  interval: Interval;
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [justSaved, setJustSaved] = React.useState(false);

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        const nextName = String(formData.get("name") ?? "").trim() || name;
        startTransition(async () => {
          try {
            await updateProduct(formData);
            setJustSaved(true);
            window.setTimeout(() => setJustSaved(false), 2200);
            success("Changes saved", `${nextName} is up to date.`);
          } catch (err) {
            error(
              "Could not save product",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Input name="name" defaultValue={name} required disabled={pending} />
      <Input
        name="description"
        defaultValue={description}
        placeholder="Description"
        disabled={pending}
      />
      <Input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        required
        defaultValue={amount}
        disabled={pending}
      />
      <select
        name="interval"
        className={selectClassName}
        defaultValue={interval}
        disabled={pending}
      >
        <option value="WEEKLY">Weekly</option>
        <option value="MONTHLY">Monthly</option>
        <option value="YEARLY">Yearly</option>
      </select>
      <Button
        type="submit"
        variant={justSaved ? "secondary" : "outline"}
        size="sm"
        className="sm:col-span-2 w-fit"
        disabled={pending || justSaved}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : justSaved ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : null}
        {pending ? "Saving…" : justSaved ? "Saved" : "Save"}
      </Button>
    </form>
  );
}

export function ProductStatusActions({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<void>, message: string, description?: string) => {
    startTransition(async () => {
      try {
        await fn();
        success(message, description);
      } catch (err) {
        error("Action failed", err instanceof Error ? err.message : undefined);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.set("id", id);
          formData.set("active", archived ? "true" : "false");
          run(
            () => setProductActive(formData),
            archived ? "Product restored" : "Product archived",
            archived
              ? `${name} is back in the invoice catalog.`
              : `${name} is hidden from new invoices.`
          );
        }}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {archived ? "Restore" : "Archive"}
      </Button>
      {archived ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${name}?`,
              description:
                "This removes it from the catalog for good. Existing invoices keep their amounts — they just lose the product link.",
              confirmLabel: "Delete permanently",
              tone: "destructive",
            });
            if (!ok) return;
            const formData = new FormData();
            formData.set("id", id);
            run(() => deleteProduct(formData), "Product deleted", `${name} is gone.`);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
          Delete
        </Button>
      ) : null}
    </div>
  );
}
