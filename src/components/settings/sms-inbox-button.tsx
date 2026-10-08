"use client";

import { useTransition } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { registerSmsInbox } from "@/actions/texts";

export function SmsInboxButton() {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await registerSmsInbox();
            if ("error" in result) {
              error("Could not turn on the inbox", result.error);
              return;
            }
            success("Text inbox is on", "Replies to your Voixly number will show up in Texts.");
          } catch (err) {
            error("Could not turn on the inbox", actionErrorMessage(err));
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Smartphone className="h-4 w-4" aria-hidden />
      )}
      Send texts to this inbox
    </Button>
  );
}
