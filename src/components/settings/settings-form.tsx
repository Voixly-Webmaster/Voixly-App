"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { Loader2 } from "lucide-react";

export function SettingsForm({
  action,
  children,
  submitLabel = "Save changes",
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="max-w-xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await action(formData);
            success("Settings saved");
          } catch (err) {
            error(
              "Could not save settings",
              err instanceof Error ? err.message : undefined
            );
          }
        });
      }}
    >
      {children}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submitLabel}
      </Button>
    </form>
  );
}
