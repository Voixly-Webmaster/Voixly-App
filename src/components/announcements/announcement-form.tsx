"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { deliverySummary } from "@/lib/delivery-summary";
import { createAnnouncement } from "@/actions/announcements";

export function AnnouncementForm() {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);

  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData();
        formData.set("title", title);
        formData.set("body", body);
        if (publish) formData.set("publish", "on");
        startTransition(async () => {
          try {
            const result = await createAnnouncement(formData);
            success(
              result.delivery ? "Announcement published" : "Draft saved",
              result.delivery ? deliverySummary(result.delivery) : undefined
            );
            setTitle("");
            setBody("");
            setPublish(true);
            router.refresh();
          } catch (err) {
            error("Could not publish announcement", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="announcement-title">Title</Label>
        <Input
          id="announcement-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="announcement-body">Body</Label>
        <Textarea
          id="announcement-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          disabled={pending}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="rounded"
          disabled={pending}
        />
        Publish now and notify clients by email and text
      </label>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {publish ? "Publish" : "Save draft"}
      </Button>
    </form>
  );
}
