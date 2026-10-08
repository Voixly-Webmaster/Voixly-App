"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  beginSignIn,
  finishSignIn,
  resendSignInCode,
  verifySignInCode,
} from "@/actions/account-access";
import type { TwoFactorChannel } from "@prisma/client";

type CodeStep = {
  challengeId: string;
  channel: TwoFactorChannel;
  destination: string;
  channels: TwoFactorChannel[];
};

function isRedirect(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function LoginForm({
  callbackUrl,
  defaultEmail,
}: {
  callbackUrl: string;
  defaultEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<CodeStep | null>(null);
  const [code, setCode] = useState("");

  return (
    <div className="space-y-4">
      {error && (
        <p
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {step ? (
        <form
          key="code"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            setError(null);
            startTransition(async () => {
              try {
                const result = await verifySignInCode(step.challengeId, code);
                if (result.status === "ticket") {
                  await finishSignIn(result.email, result.ticket, callbackUrl);
                  return;
                }
                setError(result.message);
              } catch (err) {
                if (isRedirect(err)) throw err;
                setError("Sign-in is temporarily unavailable. Please try again.");
              }
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">{step.destination}</span>.
            It expires in 10 minutes.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Sign-in code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="font-mono tracking-[0.3em]"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Verify and sign in
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              disabled={pending}
              onClick={() => {
                setStep(null);
                setCode("");
                setError(null);
              }}
            >
              Use a different account
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="font-medium text-primary hover:underline disabled:opacity-50"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await resendSignInCode(step.challengeId, step.channel);
                    if (result.status === "error") {
                      setError(result.message);
                      return;
                    }
                    setStep(result);
                    setCode("");
                  });
                }}
              >
                Resend code
              </button>
              {step.channels
                .filter((channel) => channel !== step.channel)
                .map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await resendSignInCode(step.challengeId, channel);
                        if (result.status === "error") {
                          setError(result.message);
                          return;
                        }
                        setStep(result);
                        setCode("");
                      });
                    }}
                  >
                    {channel === "SMS" ? "Text me instead" : "Email me instead"}
                  </button>
                ))}
            </div>
          </div>
        </form>
      ) : (
        <form
          key="password"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            const formData = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const result = await beginSignIn({
                  email: String(formData.get("email") ?? ""),
                  password: String(formData.get("password") ?? ""),
                });
                if (result.status === "invalid") {
                  setError("Invalid email or password.");
                  return;
                }
                if (result.status === "error") {
                  setError(result.message);
                  return;
                }
                if (result.status === "2fa") {
                  setStep(result);
                  setCode("");
                  return;
                }
                await finishSignIn(result.email, result.ticket, callbackUrl);
              } catch (err) {
                if (isRedirect(err)) throw err;
                setError("Sign-in is temporarily unavailable. Please try again.");
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={defaultEmail}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Sign in
          </Button>
        </form>
      )}
    </div>
  );
}
