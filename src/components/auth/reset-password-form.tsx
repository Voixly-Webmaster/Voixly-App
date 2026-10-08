"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordWithToken } from "@/actions/account-access";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          This reset link is missing a token. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await resetPasswordWithToken(
            token,
            String(formData.get("password") ?? ""),
            String(formData.get("confirm") ?? "")
          );
          if (!result.ok) {
            setError(result.error);
            return;
          }
          window.location.assign("/login?notice=password-reset");
        });
      }}
    >
      {error && (
        <p
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Save password
      </Button>
    </form>
  );
}
