"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { sendTestSms } from "@/actions/settings";
import { Loader2 } from "lucide-react";

export function TestSmsButton() {
  const { success, error } = useToast();
  const [phone, setPhone] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        startTransition(async () => {
          try {
            const result = await sendTestSms(phone);
            if (!result.ok) {
              error("Could not send test text", result.error);
              return;
            }
            success("Test text sent", `Check ${phone}`);
          } catch (err) {
            error("Could not send test text", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="test-sms-phone">Send a test to</Label>
        <Input
          id="test-sms-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
          autoComplete="tel"
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending || !phone.trim()}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Send test text
      </Button>
    </form>
  );
}
