"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import {
  MESSAGE_FLOWS,
  MESSAGE_GROUPS,
  composeMessage,
  flowHasEmail,
  flowHasSms,
  mergeFlowValues,
  sampleVars,
  type MessageFlow,
} from "@/lib/message-catalog";
import { resetMessageTemplate, saveMessageTemplate } from "@/actions/message-templates";
import { Loader2, RotateCcw } from "lucide-react";

function TokenText({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("{{") ? (
          <span key={index} className="rounded bg-primary/10 px-1 font-medium text-primary">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function fieldText(flow: MessageFlow, values: Record<string, string>, key: string): string {
  return values[key] ?? flow.fields.find((field) => field.key === key)?.defaultValue ?? "";
}

function FlowCard({
  flow,
  saved,
}: {
  flow: MessageFlow;
  saved: Record<string, string> | undefined;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(() => mergeFlowValues(flow, saved));
  const [pending, startTransition] = React.useTransition();
  const focusRef = React.useRef<{ key: string; el: HTMLInputElement | HTMLTextAreaElement } | null>(
    null
  );
  const savedKey = JSON.stringify(saved ?? {});

  React.useEffect(() => {
    setDraft(mergeFlowValues(flow, saved));
  }, [flow, savedKey, saved]);

  const values = mergeFlowValues(flow, saved);
  const customized = flow.fields.some((field) => values[field.key] !== field.defaultValue);
  const dirty = flow.fields.some((field) => draft[field.key] !== values[field.key]);
  const preview = composeMessage(flow, editing ? draft : values, sampleVars(flow));

  function insertToken(token: string) {
    const current = focusRef.current;
    const key = current?.key ?? flow.fields[0]?.key;
    if (!key) return;
    const el = current?.el;
    const source = el && current?.key === key ? el.value : (draft[key] ?? "");
    const start = el && current?.key === key ? (el.selectionStart ?? source.length) : source.length;
    const end = el && current?.key === key ? (el.selectionEnd ?? start) : start;
    const snippet = `{{${token}}}`;
    const next = source.slice(0, start) + snippet + source.slice(end);
    setDraft((currentDraft) => ({ ...currentDraft, [key]: next }));
    requestAnimationFrame(() => {
      const node = focusRef.current?.el;
      if (!node || focusRef.current?.key !== key) return;
      node.focus();
      const pos = start + snippet.length;
      node.setSelectionRange(pos, pos);
    });
  }

  function onSave() {
    startTransition(async () => {
      try {
        const result = await saveMessageTemplate(flow.id, draft);
        if (!result.ok) {
          error("Could not save", result.error);
          return;
        }
        success("Message saved", flow.name);
        setEditing(false);
        router.refresh();
      } catch (err) {
        error("Could not save", actionErrorMessage(err));
      }
    });
  }

  function onReset() {
    startTransition(async () => {
      try {
        const result = await resetMessageTemplate(flow.id);
        if (!result.ok) {
          error("Could not reset", result.error);
          return;
        }
        success("Restored the original wording", flow.name);
        setEditing(false);
        router.refresh();
      } catch (err) {
        error("Could not reset", actionErrorMessage(err));
      }
    });
  }

  return (
    <article id={flow.id} className="scroll-mt-24 rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{flow.name}</h3>
            {flowHasEmail(flow) && <Badge>Email</Badge>}
            {flowHasSms(flow) && <Badge variant="secondary">Text</Badge>}
            {customized && <Badge variant="warning">Edited</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {flow.when}. Sent to {flow.audience.charAt(0).toLowerCase() + flow.audience.slice(1)}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(mergeFlowValues(flow, saved));
            setEditing((open) => !open);
          }}
        >
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {!editing && (
        <div className="space-y-4 px-4 py-4 text-sm sm:px-5">
          {flowHasEmail(flow) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
              <p>
                <span className="text-muted-foreground">Subject: </span>
                <TokenText text={fieldText(flow, values, "subject")} />
              </p>
              <p className="whitespace-pre-wrap text-foreground/90">
                <TokenText text={fieldText(flow, values, "body")} />
              </p>
              {flow.fields.some((field) => field.key === "button") && (
                <p>
                  <span className="text-muted-foreground">Button: </span>
                  <TokenText text={fieldText(flow, values, "button")} />
                </p>
              )}
            </div>
          )}
          {flowHasSms(flow) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text</p>
              <p className="whitespace-pre-wrap">
                <TokenText text={fieldText(flow, values, "sms")} />
              </p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="grid gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] sm:px-5">
          <div className="space-y-4">
            {flow.tokens.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Insert a detail
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {flow.tokens.map((token) => (
                    <button
                      key={token.token}
                      type="button"
                      title={token.label}
                      className="rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      onClick={() => insertToken(token.token)}
                    >
                      {`{{${token.token}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {flow.fields.map((field) => {
              const id = `${flow.id}-${field.key}`;
              const shared = {
                id,
                value: draft[field.key] ?? "",
                disabled: pending,
                onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  focusRef.current = { key: field.key, el: event.currentTarget };
                },
                onChange: (
                  event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                ) => setDraft((current) => ({ ...current, [field.key]: event.target.value })),
              };
              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={id}>{field.label}</Label>
                  {field.multiline ? (
                    <Textarea {...shared} rows={field.key === "body" || field.key === "sms" ? 5 : 3} />
                  ) : (
                    <Input {...shared} />
                  )}
                  {field.requiredTokens && field.requiredTokens.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Keep {field.requiredTokens.map((token) => `{{${token}}}`).join(" and ")} in this
                      text.
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSave} disabled={pending || !dirty}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                disabled={pending || (!customized && !dirty)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Restore original
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview with sample details
            </p>
            {preview.html && (
              <iframe
                title={`${flow.name} email preview`}
                sandbox=""
                srcDoc={preview.html}
                className="h-[460px] w-full rounded-xl border border-border/80 bg-white"
              />
            )}
            {preview.sms && (
              <div className="max-w-sm rounded-2xl rounded-bl-md bg-[#0a0f14] px-4 py-3 text-sm leading-relaxed text-white">
                {preview.sms}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function MessageCatalog({
  overrides,
}: {
  overrides: Record<string, Record<string, string>>;
}) {
  const [query, setQuery] = React.useState("");
  const [channel, setChannel] = React.useState<"all" | "email" | "sms" | "edited">("all");
  const needle = query.trim().toLowerCase();

  const visible = MESSAGE_FLOWS.filter((flow) => {
    const values = mergeFlowValues(flow, overrides[flow.id]);
    const edited = flow.fields.some((field) => values[field.key] !== field.defaultValue);
    if (channel === "email" && !flowHasEmail(flow)) return false;
    if (channel === "sms" && !flowHasSms(flow)) return false;
    if (channel === "edited" && !edited) return false;
    if (!needle) return true;
    const haystack = [
      flow.name,
      flow.when,
      flow.audience,
      ...flow.fields.map((field) => values[field.key]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  const filters = [
    { id: "all", label: "All" },
    { id: "email", label: "Email" },
    { id: "sms", label: "Text" },
    { id: "edited", label: "Edited" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/80 bg-muted/30 p-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={channel === filter.id}
              className={
                channel === filter.id
                  ? "rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
              onClick={() => setChannel(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search messages"
          aria-label="Search messages"
          className="sm:max-w-xs"
        />
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages match.</p>
      )}

      {MESSAGE_GROUPS.map((group) => {
        const flows = visible.filter((flow) => flow.group === group);
        if (flows.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h2>
            <div className="space-y-3">
              {flows.map((flow) => (
                <FlowCard key={flow.id} flow={flow} saved={overrides[flow.id]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
