"use client";

import { useRef, useEffect } from "react";
import { formatDateTime } from "@/lib/utils";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending..." : "Send reply"}
    </Button>
  );
}

export function TicketThread({
  messages,
  sendAction,
}: {
  messages: {
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: Date;
    author: { name: string | null; email: string };
  }[];
  sendAction: (formData: FormData) => Promise<void>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <Panel title="Conversation" accent="none" noPadding>
      <div className="flex flex-col">
        <div className="max-h-[480px] space-y-3 overflow-y-auto bg-muted/20 p-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isStaff ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.isStaff
                    ? "border border-border/80 bg-card shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p
                  className={`mt-2 text-xs ${
                    msg.isStaff ? "text-muted-foreground" : "text-primary-foreground/80"
                  }`}
                >
                  {msg.author.name ?? msg.author.email} · {formatDateTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form action={sendAction} className="space-y-3 border-t border-border/60 p-5">
          <Textarea name="body" placeholder="Type your message..." required rows={3} />
          <SubmitButton />
        </form>
      </div>
    </Panel>
  );
}
