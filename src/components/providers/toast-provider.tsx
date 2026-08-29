"use client";

import * as React from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider as RadixToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";

type ToastVariant = "default" | "success" | "destructive" | "info";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  success: (msg: string, description?: string) => void;
  error: (msg: string, description?: string) => void;
  info: (msg: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((input: ToastInput) => {
    setToasts((prev) => [
      ...prev,
      { ...input, id: Date.now() + Math.random() },
    ]);
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (msg, description) =>
        push({ title: msg, description, variant: "success" }),
      error: (msg, description) =>
        push({ title: msg, description, variant: "destructive" }),
      info: (msg, description) =>
        push({ title: msg, description, variant: "info" }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      <RadixToastProvider swipeDirection="right" duration={4500}>
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            duration={t.durationMs}
            onOpenChange={(open) => {
              if (!open) {
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }
            }}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            ) : t.variant === "destructive" ? (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            ) : t.variant === "info" ? (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
            ) : null}
            <div className="min-w-0 flex-1">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              {t.description && (
                <ToastDescription>{t.description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}
