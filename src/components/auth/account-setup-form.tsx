"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeAccountSetup, type InvitePreview } from "@/actions/invites";

export function AccountSetupForm({
  token,
  preview,
}: {
  token: string;
  preview: InvitePreview;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await completeAccountSetup({
            token,
            password: String(formData.get("password") ?? ""),
            confirm: String(formData.get("confirm") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            allowSms: formData.get("allowSms") === "on",
          });
          if ("error" in result) {
            setError(result.error);
            return;
          }
          window.location.assign("/login?notice=account-ready");
        });
      }}
    >
      <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-3 text-sm">
        {preview.kind === "team" ? (
          <>
            <p className="font-medium text-foreground">Voixly team</p>
            <p className="mt-1 text-muted-foreground">You&apos;ll join as {preview.roleLabel}.</p>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground">
              {preview.product || preview.company}
            </p>
            <p className="mt-1 text-muted-foreground">
              {preview.product ? preview.company : "Voixly ClientHub"}
              {preview.amount ? ` · ${preview.amount}` : ""}
              {preview.interval ? ` ${preview.interval}` : ""}
            </p>
            {preview.description ? (
              <p className="mt-2 text-muted-foreground">{preview.description}</p>
            ) : null}
          </>
        )}
      </div>

      {error && (
        <p
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="setup-password">Password</Label>
        <Input
          id="setup-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="setup-confirm">Confirm password</Label>
        <Input
          id="setup-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="setup-phone">Mobile number</Label>
        <Input
          id="setup-phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="(555) 555-0100"
          disabled={pending}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="allowSms"
          required
          disabled={pending}
          className="mt-1 h-4 w-4 rounded border-input"
        />
        <span>
          {preview.kind === "team"
            ? "I agree to receive text messages from Voixly at this number about my account."
            : "I agree to receive text messages from Voixly at this number about my account, invoices, and updates."}
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Finish setup
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll sign in as {preview.email}.
      </p>
    </form>
  );
}
