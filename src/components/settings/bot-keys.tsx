"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { actionErrorMessage } from "@/lib/action-error";
import { createBot, revokeBot } from "@/actions/bots";
import { BOT_SCOPES, INBOX_SCOPES, type BotScope } from "@/lib/bot-scopes";

const SCOPE_LABELS: Record<BotScope, string> = {
  "customers:read": "Look up customers",
  "texts:read": "Read the text inbox",
  "texts:reply": "Reply and link a number",
  "tasks:write": "Create and update tasks",
  "billing:read": "Read invoices",
  "support:read": "Read support tickets",
  "support:write": "Reply to support tickets",
};

const inputClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type BotKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

export function BotKeys({ bots, apiBase }: { bots: BotKeyRow[]; apiBase: string }) {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{ name: string; token: string } | null>(null);

  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          startTransition(async () => {
            try {
              const result = await createBot(data);
              if ("error" in result) {
                error("Could not create a key", result.error);
                return;
              }
              setRevealed({ name: result.name, token: result.token });
              form.reset();
              success("Bot key created", "Copy it now. It will not be shown again.");
              router.refresh();
            } catch (err) {
              error("Could not create a key", actionErrorMessage(err));
            }
          });
        }}
      >
        <div className="space-y-2">
          <label htmlFor="bot-name" className="text-sm font-medium">
            Name
          </label>
          <input id="bot-name" name="name" required maxLength={40} placeholder="Inbox" className={inputClassName} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Access</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOT_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  defaultChecked={INBOX_SCOPES.includes(scope)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                {SCOPE_LABELS[scope]}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
          Create bot key
        </Button>
      </form>

      {revealed && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Key for {revealed.name}</p>
          <p className="text-xs text-muted-foreground">
            Copy this into Grok now. ClientHub only stores a hash, so it cannot show the key again.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={revealed.token} className={`${inputClassName} font-mono text-xs`} aria-label="Bot key" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealed.token).then(
                  () => success("Key copied"),
                  () => error("Could not copy", "Select the key and copy it yourself.")
                );
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Give Grok the key and this address:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{apiBase}</code>
        </p>
        <p>
          Send it as <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">Authorization: Bearer vx_live_…</code>.
          Writes also need an <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">Idempotency-Key</code> header.
        </p>
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80">
        {bots.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted-foreground">No bot keys yet.</li>
        )}
        {bots.map((bot) => (
          <li key={bot.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">
                {bot.name}{" "}
                {bot.revoked && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Revoked
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{bot.prefix}…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bot.scopes || "No access"} · Created {bot.createdAt}
                {bot.lastUsedAt ? ` · Last used ${bot.lastUsedAt}` : ""}
              </p>
            </div>
            {!bot.revoked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  void (async () => {
                    const ok = await confirm({
                      title: `Revoke ${bot.name}?`,
                      description: "Grok will no longer be able to use this key.",
                      confirmLabel: "Revoke",
                      tone: "destructive",
                    });
                    if (!ok) return;
                    startTransition(async () => {
                      try {
                        const result = await revokeBot(bot.id);
                        if ("error" in result) {
                          error("Could not revoke", result.error);
                          return;
                        }
                        if (revealed?.name === bot.name) setRevealed(null);
                        success("Bot key revoked");
                        router.refresh();
                      } catch (err) {
                        error("Could not revoke", actionErrorMessage(err));
                      }
                    });
                  })();
                }}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
