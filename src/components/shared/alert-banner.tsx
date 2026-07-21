import { cn } from "@/lib/utils";

export function AlertBanner({
  children,
  variant = "success",
  className,
}: {
  children: React.ReactNode;
  variant?: "success" | "info" | "warning";
  className?: string;
}) {
  const styles =
    variant === "success"
      ? "border-success/30 bg-success-muted text-success-foreground"
      : variant === "warning"
        ? "border-warning/30 bg-warning-muted text-warning-foreground"
        : "border-secondary/30 bg-secondary/10 text-foreground";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm shadow-sm",
        styles,
        className
      )}
    >
      {children}
    </div>
  );
}
