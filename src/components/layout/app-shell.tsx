"use client";

import { Menu, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useCommandPalette } from "@/components/shared/command-palette";
import { pageMaxWidth } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  navItems,
  title,
  subtitle,
  userName,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  title: string;
  subtitle?: string;
  userName?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const palette = useCommandPalette();
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="flex min-h-screen app-main-bg">
      <div className="hidden lg:block shrink-0">
        <Sidebar items={navItems} title={title} subtitle={subtitle} />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar items={navItems} title={title} subtitle={subtitle} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-card/80 px-4 shadow-sm backdrop-blur-md lg:px-8 dark:bg-card/90">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold">{title}</p>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={palette.open}
            className="hidden flex-1 items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 sm:flex sm:max-w-md"
            aria-label="Open global search"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Search clients, invoices, tickets...</span>
            </span>
            <kbd className="hidden items-center gap-0.5 rounded border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-mono lg:inline-flex">
              <span>{isMac ? "⌘" : "Ctrl"}</span>K
            </kbd>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={palette.open}
              aria-label="Open global search"
            >
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            {userName && (
              <span className="hidden rounded-full bg-muted/80 px-3 py-1 text-sm text-muted-foreground md:inline">
                {userName}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <main className={cn("flex-1 p-4 lg:p-8", pageMaxWidth)}>{children}</main>
      </div>
    </div>
  );
}
