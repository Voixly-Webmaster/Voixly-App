"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { selectClassName } from "@/lib/ui";
import {
  createTaskFromText,
  linkTextToClient,
  markConversationRead,
  replyToText,
  syncInboundTexts,
} from "@/actions/texts";

export function MarkTextsRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId]);
  return null;
}

export function SyncTextsButton() {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await syncInboundTexts();
            if ("error" in result) {
              error("Could not check for texts", result.error);
              return;
            }
            success(
              "Texts checked",
              result.added > 0
                ? `${result.added} new ${result.added === 1 ? "text" : "texts"} added.`
                : "No new texts."
            );
            router.refresh();
          } catch (err) {
            error("Could not check for texts", actionErrorMessage(err));
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      Check for texts
    </Button>
  );
}

export function LinkCustomerForm({
  conversationId,
  clients,
}: {
  conversationId: string;
  clients: { id: string; label: string }[];
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const result = await linkTextToClient(conversationId, clientId);
            if ("error" in result) {
              error("Could not link customer", result.error);
              return;
            }
            success("Customer linked", "New texts from this number stay on that customer.");
            router.refresh();
          } catch (err) {
            error("Could not link customer", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="link-client">Customer</Label>
        <select
          id="link-client"
          className={selectClassName}
          value={clientId}
          disabled={pending || clients.length === 0}
          onChange={(event) => setClientId(event.target.value)}
        >
          {clients.length === 0 ? (
            <option value="">No customers yet</option>
          ) : (
            clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))
          )}
        </select>
      </div>
      <Button type="submit" disabled={pending || !clientId}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Link customer
      </Button>
    </form>
  );
}

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const message = body;
        startTransition(async () => {
          try {
            const result = await replyToText(conversationId, message);
            if ("error" in result) {
              error("Could not send reply", result.error);
              return;
            }
            setBody("");
            success("Reply sent");
            router.refresh();
          } catch (err) {
            error("Could not send reply", actionErrorMessage(err));
          }
        });
      }}
    >
      <Label htmlFor="text-reply">Reply by text</Label>
      <Textarea
        id="text-reply"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply…"
        rows={3}
        required
        disabled={pending}
      />
      <Button type="submit" disabled={pending || !body.trim()}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Send text
      </Button>
    </form>
  );
}

export function MakeTaskButton({
  messageId,
  assignees,
  defaultAssigneeId,
}: {
  messageId: string;
  assignees: { id: string; label: string }[];
  defaultAssigneeId: string;
}) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Website change");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CheckSquare className="h-3.5 w-3.5" aria-hidden />
        Make a task
      </Button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2 rounded-lg border border-border/70 bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const result = await createTaskFromText({ messageId, title, assigneeId });
            if ("error" in result) {
              error("Could not create task", result.error);
              return;
            }
            success("Task created", "It's on the task list for the person you assigned.");
            setOpen(false);
            router.refresh();
          } catch (err) {
            error("Could not create task", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`task-title-${messageId}`}>Task</Label>
        <Input
          id={`task-title-${messageId}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`task-assignee-${messageId}`}>Assign to</Label>
        <select
          id={`task-assignee-${messageId}`}
          className={selectClassName}
          value={assigneeId}
          disabled={pending}
          onChange={(event) => setAssigneeId(event.target.value)}
        >
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !title.trim() || !assigneeId}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Create task
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ViewTaskLink({ taskId }: { taskId: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/admin/tasks/${taskId}`}>
        <CheckSquare className="h-3.5 w-3.5" aria-hidden />
        View task
      </Link>
    </Button>
  );
}
