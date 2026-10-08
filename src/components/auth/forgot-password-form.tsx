"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/actions/account-access";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way. The
          link expires in one hour.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
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
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await requestPasswordResetAction(email);
            setSent(true);
          } catch {
            setError("Something went wrong. Try again in a moment.");
          }
        });
      }}
    >
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Send reset link
      </Button>
      <Link
        href="/login"
        className="inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}
