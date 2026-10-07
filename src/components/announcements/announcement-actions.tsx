"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import {
  deleteAnnouncement,
  setAnnouncementPublished,
} from "@/actions/announcements";

export function AnnouncementActions({
  id,
  title,
  published,
}: {
  id: string;
  title: string;
  published: boolean;
}) {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>, message: string) => {
    startTransition(async () => {
      try {
        await fn();
        success(message);
      } catch (err) {
        error("Could not update announcement", actionErrorMessage(err));
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.set("id", id);
          formData.set("published", published ? "false" : "true");
          run(
            () => setAnnouncementPublished(formData),
            published ? "Announcement unpublished" : "Announcement published"
          );
        }}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {published ? "Unpublish" : "Publish"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: `Remove “${title}”?`,
            description: "Clients will no longer see this announcement.",
            confirmLabel: "Remove",
            tone: "destructive",
          });
          if (!ok) return;
          const formData = new FormData();
          formData.set("id", id);
          run(() => deleteAnnouncement(formData), "Announcement removed");
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
        Remove
      </Button>
    </div>
  );
}
