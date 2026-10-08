"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import {
  confirmDisableTwoFactor,
  confirmTwoFactor,
  sendDisableCode,
  sendTwoFactorCode,
} from "@/actions/account-access";
import type { TwoFactorChannel } from "@prisma/client";

type Prompt = {
  mode: "enable" | "disable";
  channel: TwoFactorChannel;
  challengeId: string;
  destination: string;
};

export function TwoFactorForm({
  email,
  emailOn,
  smsOn,
  smsPhone,
  suggestedPhone,
  emailReady,
  smsReady,
}: {
  email: string;
  emailOn: boolean;
  smsOn: boolean;
  smsPhone: string | null;
  suggestedPhone: string;
  emailReady: boolean;
  smsReady: boolean;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(smsPhone || suggestedPhone);

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        error("Could not update sign-in codes", actionErrorMessage(err));
      }
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        After your password, Voixly sends a 6-digit code. You can use email,
        text, or both.
      </p>

      {(emailOn || smsOn) && (
        <div className="space-y-2">
          <Label htmlFor="disable-password">Current password</Label>
          <Input
            id="disable-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Required to turn a method off. We’ll send a code to confirm.
          </p>
        </div>
      )}

      <section className="space-y-3 rounded-xl border border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Email</h3>
            <p className="text-sm text-muted-foreground">
              {emailOn ? `Codes go to ${email}` : `Send codes to ${email} with Resend`}
            </p>
          </div>
          <Status on={emailOn} />
        </div>
        {!emailReady && !emailOn ? (
          <p className="text-sm text-muted-foreground">
            An admin needs to add a Resend API key before email codes can be sent.
          </p>
        ) : emailOn ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !password}
            onClick={() =>
              run(async () => {
                const sent = await sendDisableCode("EMAIL", password);
                setPrompt({ mode: "disable", channel: "EMAIL", ...sent });
                setCode("");
                success("Code sent", `Check ${sent.destination}`);
              })
            }
          >
            Turn off email codes
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const sent = await sendTwoFactorCode("EMAIL", "");
                setPrompt({ mode: "enable", channel: "EMAIL", ...sent });
                setCode("");
                success("Code sent", `Check ${sent.destination}`);
              })
            }
          >
            Email me a code
          </Button>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Text message</h3>
            <p className="text-sm text-muted-foreground">
              {smsOn && smsPhone
                ? `Codes go to ${smsPhone}`
                : "Send codes through VoidFix"}
            </p>
          </div>
          <Status on={smsOn} />
        </div>
        {!smsReady && !smsOn ? (
          <p className="text-sm text-muted-foreground">
            An admin needs to connect VoidFix under Settings → SMS before text
            codes can be sent.
          </p>
        ) : smsOn ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !password}
            onClick={() =>
              run(async () => {
                const sent = await sendDisableCode("SMS", password);
                setPrompt({ mode: "disable", channel: "SMS", ...sent });
                setCode("");
                success("Code sent", `Check ${sent.destination}`);
              })
            }
          >
            Turn off text codes
          </Button>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sms-phone">Mobile number</Label>
            <Input
              id="sms-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
              disabled={pending}
            />
            <Button
              type="button"
              disabled={pending || !phone.trim()}
              onClick={() =>
                run(async () => {
                  const sent = await sendTwoFactorCode("SMS", phone);
                  setPrompt({ mode: "enable", channel: "SMS", ...sent });
                  setCode("");
                  success("Code sent", `Check ${sent.destination}`);
                })
              }
            >
              Text me a code
            </Button>
          </div>
        )}
      </section>

      {prompt && (
        <form
          className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            run(async () => {
              if (prompt.mode === "enable") {
                await confirmTwoFactor(prompt.challengeId, code);
                success("Sign-in codes are on");
              } else {
                await confirmDisableTwoFactor(prompt.challengeId, code);
                success("Sign-in codes updated");
              }
              setPrompt(null);
              setCode("");
              setPassword("");
              router.refresh();
            });
          }}
        >
          <Label htmlFor="verify-code">Code sent to {prompt.destination}</Label>
          <Input
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="font-mono tracking-[0.3em]"
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Confirm code
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPrompt(null);
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Status({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success-foreground"
          : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {on ? "On" : "Off"}
    </span>
  );
}
