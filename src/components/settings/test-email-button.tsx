"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { sendTestEmail } from "@/actions/settings";
import { Loader2 } from "lucide-react";

export function TestEmailButton() {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await sendTestEmail();
            if (!result.ok) {
              error("Could not send test email", result.error);
              return;
            }
            success("Test email sent", "Check the inbox for the signed-in admin.");
          } catch (err) {
            error("Could not send test email", actionErrorMessage(err));
          }
        });
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      Send test email
    </Button>
  );
}
