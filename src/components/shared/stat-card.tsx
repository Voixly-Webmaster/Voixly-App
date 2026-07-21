import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  href?: string;
  icon?: LucideIcon;
  accent?: "primary" | "secondary" | "neutral";
}) {
  const iconBg =
    accent === "secondary"
      ? "bg-secondary/15 text-secondary"
      : accent === "neutral"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-elevated transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
