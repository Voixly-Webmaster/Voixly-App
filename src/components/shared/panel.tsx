import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Panel({
  children,
  className,
  title,
  description,
  icon: Icon,
  action,
  accent = "default",
  noPadding,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  accent?: "default" | "primary" | "secondary" | "none";
  noPadding?: boolean;
}) {
  const accentBar =
    accent === "primary"
      ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
      : accent === "secondary"
        ? "bg-gradient-to-r from-secondary/20 via-secondary/5 to-transparent"
        : accent === "none"
          ? ""
          : "bg-muted/30";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm shadow-elevated",
        className
      )}
    >
      {(title || description) && (
        <div
          className={cn(
            "flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            accentBar
          )}
        >
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div>
              {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
              {description && (
                <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>{children}</div>
    </section>
  );
}
