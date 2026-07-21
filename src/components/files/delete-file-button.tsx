"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { deleteFile } from "@/actions/files";

export function DeleteFileButton({
  fileId,
  fileName,
}: {
  fileId: string;
  fileName: string;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      aria-label={`Delete ${fileName}`}
      onClick={async () => {
        const ok = await confirm({
          title: "Delete file?",
          description: (
            <>
              <strong className="text-foreground">{fileName}</strong> will be
              moved to trash. This can&apos;t be undone from the UI.
            </>
          ),
          tone: "destructive",
          confirmLabel: "Delete",
        });
        if (!ok) return;
        startTransition(async () => {
          try {
            await deleteFile(fileId);
            toast.success("File deleted");
          } catch (err) {
            toast.error(
              "Could not delete file",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}
