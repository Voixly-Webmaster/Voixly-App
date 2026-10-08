"use client";

import { useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { resendClientInvite } from "@/actions/invites";

export function ResendInviteButton({ clientId }: { clientId: string }) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await resendClientInvite(clientId);
            if ("error" in result) {
              error("Could not resend invite", result.error);
              return;
            }
            success(
              "Invite resent",
              result.emailSent
                ? "A new setup link is on its way. The previous link no longer works."
                : "A new link was created, but the email did not send."
            );
          } catch (err) {
            error("Could not resend invite", actionErrorMessage(err));
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Mail className="h-3.5 w-3.5" aria-hidden />
      )}
      Resend invite
    </Button>
  );
}
