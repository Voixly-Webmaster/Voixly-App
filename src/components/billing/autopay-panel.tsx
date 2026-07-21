"use client";

import * as React from "react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/lib/ui";
import { useToast } from "@/components/providers/toast-provider";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  createAutopaySetupSession,
  disableAutopay,
  updateAutopayDay,
} from "@/actions/autopay";
import { CreditCard, Loader2 } from "lucide-react";

export function AutopayPanel({
  enabled,
  autopayDay,
  cardHint,
}: {
  enabled: boolean;
  autopayDay: number;
  cardHint?: string | null;
}) {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  return (
    <Panel
      title="Monthly Autopay"
      description={
        enabled
          ? "Your card is charged automatically for open invoices each month — and when new invoices are sent."
          : "Save a card once and we’ll charge open invoices automatically on your billing day."
      }
      icon={CreditCard}
      accent="primary"
      action={
        enabled ? (
          <span className="rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success-foreground">
            On
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Off
          </span>
        )
      }
    >
      {enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {cardHint
              ? `Card on file: ${cardHint}`
              : "A payment method is saved for automatic charges."}
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              startTransition(async () => {
                try {
                  await updateAutopayDay(formData);
                  success("Billing day updated");
                } catch (err) {
                  error(
                    "Could not update day",
                    err instanceof Error ? err.message : undefined
                  );
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="autopay-day">Charge open invoices on day</Label>
              <select
                id="autopay-day"
                name="autopayDay"
                defaultValue={String(autopayDay)}
                className={selectClassName}
                disabled={pending}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Save day
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const { url } = await createAutopaySetupSession();
                    if (url) window.location.href = url;
                  } catch (err) {
                    error(
                      "Could not update card",
                      err instanceof Error ? err.message : undefined
                    );
                  }
                });
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Update card
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Turn off Autopay?",
                  description:
                    "We won’t charge your card automatically anymore. You can still pay invoices manually.",
                  confirmLabel: "Turn off",
                  tone: "destructive",
                });
                if (!ok) return;
                startTransition(async () => {
                  try {
                    await disableAutopay();
                    success("Autopay turned off");
                  } catch (err) {
                    error(
                      "Could not disable Autopay",
                      err instanceof Error ? err.message : undefined
                    );
                  }
                });
              }}
            >
              Turn off Autopay
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-sm text-muted-foreground">
            You’ll be redirected to Stripe to securely save a card. Open invoices
            are charged right away, then again each month on the day you choose
            (default: the 1st).
          </p>
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const { url } = await createAutopaySetupSession();
                  if (url) window.location.href = url;
                } catch (err) {
                  error(
                    "Could not start Autopay setup",
                    err instanceof Error ? err.message : undefined
                  );
                }
              });
            }}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Enable monthly Autopay
          </Button>
        </div>
      )}
    </Panel>
  );
}
