"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { deleteTextMessages, deleteTextThreads } from "@/actions/texts";
import { MakeTaskButton, ViewTaskLink } from "@/components/texts/text-actions";

export type InboxThread = {
  id: string;
  name: string;
  preview: string;
  when: string;
  unread: number;
  needsCustomer: boolean;
  phonePrefix: string;
};

function checkboxClassName() {
  return "h-4 w-4 shrink-0 rounded border-input accent-primary";
}

function SelectAllBox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        ref={ref}
        type="checkbox"
        className={checkboxClassName()}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function TextInboxList({ threads }: { threads: InboxThread[] }) {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const visibleIds = threads.map((thread) => thread.id);
  const selectedIds = selected.filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  function toggle(id: string, on: boolean) {
    setSelected((current) =>
      on ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    );
  }

  function remove(ids: string[]) {
    const count = ids.length;
    startTransition(async () => {
      try {
        const result = await deleteTextThreads(ids);
        if ("error" in result) {
          error("Could not delete", result.error);
          return;
        }
        setSelected((current) => current.filter((id) => !ids.includes(id)));
        success(
          count === 1 ? "Conversation deleted" : `${count} conversations deleted`
        );
        router.refresh();
      } catch (err) {
        error("Could not delete", actionErrorMessage(err));
      }
    });
  }

  async function askRemove(ids: string[]) {
    const count = ids.length;
    const ok = await confirm({
      title: count === 1 ? "Delete this conversation?" : `Delete ${count} conversations?`,
      description:
        "The texts are removed from the inbox. A task already made from one stays on the customer's Projects page.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (ok) remove(ids);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-2.5 shadow-sm">
        <SelectAllBox
          checked={allSelected}
          indeterminate={selectedIds.length > 0 && !allSelected}
          label={selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}
          onChange={(on) => setSelected(on ? visibleIds : [])}
        />
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || selectedIds.length === 0}
          onClick={() => void askRemove(selectedIds)}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>

      <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        {threads.map((thread) => (
          <li
            key={thread.id}
            className="flex items-stretch border-b border-border/60 last:border-b-0"
          >
            <label className="flex items-center px-4">
              <input
                type="checkbox"
                className={checkboxClassName()}
                checked={selectedIds.includes(thread.id)}
                aria-label={`Select ${thread.name}`}
                disabled={pending}
                onChange={(event) => toggle(thread.id, event.target.checked)}
              />
            </label>
            <Link
              href={`/admin/texts/${thread.id}`}
              className="flex min-w-0 flex-1 items-start justify-between gap-4 py-4 pr-2 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {thread.name}
                  {thread.unread > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      {thread.unread} new
                    </span>
                  )}
                  {thread.needsCustomer && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Needs a customer
                    </span>
                  )}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {thread.phonePrefix}
                  {thread.preview}
                </p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">{thread.when}</time>
            </Link>
            <div className="flex items-center pr-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                aria-label={`Delete conversation with ${thread.name}`}
                onClick={() => void askRemove([thread.id])}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ThreadMessageItem = {
  id: string;
  body: string;
  inbound: boolean;
  sentAtLabel: string;
  sentAtIso: string;
  optOut: boolean;
  taskId: string | null;
};

export function TextThreadMessages({
  conversationId,
  messages,
  linked,
  assignees,
  defaultAssigneeId,
}: {
  conversationId: string;
  messages: ThreadMessageItem[];
  linked: boolean;
  assignees: { id: string; label: string }[];
  defaultAssigneeId: string;
}) {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const ids = messages.map((message) => message.id);
  const selectedIds = selected.filter((id) => ids.includes(id));
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;

  function toggle(id: string, on: boolean) {
    setSelected((current) =>
      on ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    );
  }

  function remove(messageIds: string[]) {
    const count = messageIds.length;
    startTransition(async () => {
      try {
        const result = await deleteTextMessages(messageIds);
        if ("error" in result) {
          error("Could not delete", result.error);
          return;
        }
        if (result.emptied.includes(conversationId)) {
          success(count === 1 ? "Text deleted" : `${count} texts deleted`);
          router.push("/admin/texts");
          router.refresh();
          return;
        }
        setSelected((current) => current.filter((id) => !messageIds.includes(id)));
        success(count === 1 ? "Text deleted" : `${count} texts deleted`);
        router.refresh();
      } catch (err) {
        error("Could not delete", actionErrorMessage(err));
      }
    });
  }

  async function askRemove(messageIds: string[]) {
    const count = messageIds.length;
    const ok = await confirm({
      title: count === 1 ? "Delete this text?" : `Delete ${count} texts?`,
      description:
        "Removed from this thread. A task already made from a text stays on the customer's Projects page.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (ok) remove(messageIds);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectAllBox
          checked={allSelected}
          indeterminate={selectedIds.length > 0 && !allSelected}
          label={selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}
          onChange={(on) => setSelected(on ? ids : [])}
        />
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || selectedIds.length === 0}
          onClick={() => void askRemove(selectedIds)}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>

      <ol className="space-y-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={message.inbound ? "mr-8 sm:mr-16" : "ml-8 sm:ml-16"}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className={`${checkboxClassName()} mt-3`}
                checked={selectedIds.includes(message.id)}
                aria-label="Select text"
                disabled={pending}
                onChange={(event) => toggle(message.id, event.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={
                    message.inbound
                      ? "rounded-2xl rounded-tl-md bg-muted px-4 py-3"
                      : "rounded-2xl rounded-tr-md bg-primary/10 px-4 py-3"
                  }
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{message.inbound ? "Customer" : "Voixly"}</span>
                  <time dateTime={message.sentAtIso}>{message.sentAtLabel}</time>
                  {message.optOut && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                      Opt-out
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={pending}
                    aria-label="Delete text"
                    onClick={() => void askRemove([message.id])}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    Delete
                  </Button>
                </div>
                {message.inbound && (
                  <div className="mt-2">
                    {message.taskId ? (
                      <ViewTaskLink taskId={message.taskId} />
                    ) : linked ? (
                      <MakeTaskButton
                        messageId={message.id}
                        defaultAssigneeId={defaultAssigneeId}
                        assignees={assignees}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Link a customer to turn this into a task.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
