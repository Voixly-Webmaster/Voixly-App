"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { changePassword } from "@/actions/account-access";

export function ChangePasswordForm() {
  const { error } = useToast();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        setFormError(null);
        startTransition(async () => {
          try {
            await changePassword(
              String(formData.get("current") ?? ""),
              String(formData.get("password") ?? ""),
              String(formData.get("confirm") ?? "")
            );
            window.location.assign("/login?notice=password-changed");
          } catch (err) {
            const message = actionErrorMessage(err);
            setFormError(message);
            error("Could not update password", message);
          }
        });
      }}
    >
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Update password
      </Button>
    </form>
  );
}
