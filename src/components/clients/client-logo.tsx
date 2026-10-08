"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { removeClientLogo, setClientLogo } from "@/actions/clients";
import { cn } from "@/lib/utils";

export function ClientLogo({
  clientId,
  name,
  logoFileName,
  size = "md",
}: {
  clientId: string;
  name: string;
  logoFileName: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const box =
    size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted font-semibold text-muted-foreground",
        box
      )}
    >
      {logoFileName ? (
        // The logo is a private, session-checked image, so a plain img is the right tag.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/clients/${clientId}/logo?v=${encodeURIComponent(logoFileName)}`}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      ) : (
        initials || "•"
      )}
    </span>
  );
}

export function ClientLogoForm({
  clientId,
  companyName,
  logoFileName,
}: {
  clientId: string;
  companyName: string;
  logoFileName: string | null;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickedName, setPickedName] = useState("");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ClientLogo clientId={clientId} name={companyName} logoFileName={logoFileName} size="lg" />
      <form
        className="min-w-0 flex-1 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("clientId", clientId);
          startTransition(async () => {
            try {
              const result = await setClientLogo(data);
              if ("error" in result) {
                error("Could not save logo", result.error);
                return;
              }
              setPickedName("");
              success("Logo saved", "It shows on this profile and in their portal.");
              router.refresh();
            } catch (err) {
              error("Could not save logo", actionErrorMessage(err));
            }
          });
        }}
      >
        <p className="text-sm font-medium">Logo</p>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, WEBP, or GIF. Up to 2 MB. This is their profile image.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              disabled={pending}
              className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium"
              onChange={(event) => setPickedName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
          <Button type="submit" size="sm" disabled={pending || !pickedName}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Save logo
          </Button>
          {logoFileName && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await removeClientLogo(clientId);
                    if ("error" in result) {
                      error("Could not remove logo", result.error);
                      return;
                    }
                    success("Logo removed");
                    router.refresh();
                  } catch (err) {
                    error("Could not remove logo", actionErrorMessage(err));
                  }
                });
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
