"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { selectClassName } from "@/lib/ui";
import { sendText } from "@/actions/texts";

export type TextRecipient = { id: string; kind: "client" | "user"; label: string; group: string };

function recipientKey(recipient: { kind: string; id: string }) {
  return `${recipient.kind}:${recipient.id}`;
}

export function SendTextForm({
  recipients,
  locked,
}: {
  recipients: TextRecipient[];
  locked?: boolean;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(recipients[0] ? recipientKey(recipients[0]) : "");

  if (recipients.length === 0) {
    return <p className="text-sm text-muted-foreground">No one to text yet.</p>;
  }

  const groups = [...new Set(recipients.map((recipient) => recipient.group))];

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const message = String(new FormData(event.currentTarget).get("body") ?? "");
        const form = event.currentTarget;
        startTransition(async () => {
          try {
            const recipient = recipients.find((item) => recipientKey(item) === selected);
            if (!recipient) {
              error("Could not send the text", "Choose someone to text");
              return;
            }
            const result = await sendText(recipient.kind, recipient.id, message);
            if ("error" in result) {
              error("Could not send the text", result.error);
              return;
            }
            form.reset();
            success("Text sent", "It is in their thread.");
            router.push(`/admin/texts/${result.conversationId}`);
            router.refresh();
          } catch (err) {
            error("Could not send the text", actionErrorMessage(err));
          }
        });
      }}
    >
      {!locked && (
        <div className="space-y-2">
          <Label htmlFor="text-recipient">To</Label>
          <select
            id="text-recipient"
            className={selectClassName}
            value={selected}
            disabled={pending}
            onChange={(event) => setSelected(event.target.value)}
          >
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {recipients
                  .filter((recipient) => recipient.group === group)
                  .map((recipient) => (
                    <option key={recipientKey(recipient)} value={recipientKey(recipient)}>
                      {recipient.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="text-body">Message</Label>
        <Textarea
          id="text-body"
          name="body"
          required
          maxLength={1000}
          rows={3}
          disabled={pending}
          placeholder="Write the text to send from your Voixly number"
        />
      </div>
      <Button type="submit" disabled={pending || !selected}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        Send text
      </Button>
    </form>
  );
}
