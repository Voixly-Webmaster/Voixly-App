"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Pick the most specific nav href that matches the current path */
function getActiveHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    const matches =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`));
    if (matches && (!best || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

export function Sidebar({
  items,
  title,
  subtitle,
}: {
  items: NavItem[];
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, items);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/80 bg-sidebar shadow-elevated">
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Image
            src="/brand/voixly-logomark.png"
            alt="Voixly"
            width={28}
            height={28}
            className="rounded-md"
          />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const active = activeHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-4">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-foreground">Voixly</span>
        </p>
      </div>
    </aside>
  );
}
