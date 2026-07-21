"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light mode", icon: Sun },
  { value: "dark", label: "Dark mode", icon: Moon },
  { value: "system", label: "System theme", icon: Monitor },
] as const;

export function ThemeToggle({
  className,
  compact,
}: {
  className?: string;
  /** Icon-only on small screens when used in header */
  compact?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 animate-pulse rounded-lg bg-muted/60",
          compact ? "w-9" : "w-[7.75rem]",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 shadow-sm backdrop-blur-sm",
        className
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex items-center justify-center rounded-md transition-all duration-200",
              compact ? "h-8 w-8" : "h-8 w-9",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 1.75} />
          </button>
        );
      })}
    </div>
  );
}
