"use client";

import { Menu, LogOut, Search, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  userRole,
  avatarUrl,
  bottomNav,
  searchPlaceholder = "Search clients, invoices, tickets...",
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  title: string;
  subtitle?: string;
  userName?: string | null;
  userRole?: "ADMIN" | "STAFF" | "CLIENT";
  avatarUrl?: string | null;
  bottomNav?: NavItem[];
  searchPlaceholder?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const palette = useCommandPalette();
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const roleLabel =
    userRole === "ADMIN" ? "Admin" : userRole === "STAFF" ? "Staff" : userRole === "CLIENT" ? "Client" : null;

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
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-3 z-10"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </Button>
        <Sidebar
          items={navItems}
          title={title}
          subtitle={subtitle}
          onNavigate={() => setMobileOpen(false)}
        />
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
              <span>{searchPlaceholder}</span>
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
            {(userName || roleLabel) && (
              <span className="hidden items-center gap-2 rounded-full bg-muted/80 px-3 py-1 text-sm text-muted-foreground md:inline-flex">
                {avatarUrl && (
                  // Session-checked logo. A plain img keeps the private route.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-md object-contain"
                  />
                )}
                {userName}
                {roleLabel && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {roleLabel}
                  </span>
                )}
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
        <main
          className={cn(
            "flex-1 p-4 lg:p-8",
            bottomNav && "pb-24 lg:pb-8",
            pageMaxWidth
          )}
        >
          {children}
        </main>
        {bottomNav && bottomNav.length > 0 && <MobileBottomNav items={bottomNav} />}
      </div>
    </div>
  );
}

function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="flex h-14 items-center justify-center"
              >
                <span
                  className={cn(
                    "flex h-10 w-12 items-center justify-center rounded-2xl",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
