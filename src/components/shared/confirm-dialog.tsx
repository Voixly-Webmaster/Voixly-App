"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Tone = "default" | "destructive";

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type Resolver = (value: boolean) => void;

const ConfirmContext = React.createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function useConfirm() {
  const fn = React.useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be inside <ConfirmDialogProvider>");
  return fn;
}

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<
    (ConfirmOptions & { open: boolean; resolve: Resolver }) | null
  >(null);

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, open: true, resolve });
      }),
    []
  );

  const handleChange = (open: boolean) => {
    if (!open && state) {
      state.resolve(false);
      setState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={state?.open ?? false} onOpenChange={handleChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state?.title}</DialogTitle>
            {state?.description && (
              <DialogDescription>{state.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                state?.resolve(false);
                setState(null);
              }}
            >
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state?.tone === "destructive" ? "destructive" : "default"}
              onClick={() => {
                state?.resolve(true);
                setState(null);
              }}
              autoFocus
            >
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
