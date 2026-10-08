"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings, Users, CreditCard, Mail, Plug, Package, Smartphone } from "lucide-react";

const tabs = [
  { href: "/admin/settings", label: "General", icon: Settings, exact: true },
  { href: "/admin/settings/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/settings/payments", label: "Payments", icon: CreditCard, exact: false },
  { href: "/admin/settings/products", label: "Products", icon: Package, exact: false },
  { href: "/admin/settings/email", label: "Email", icon: Mail, exact: false },
  { href: "/admin/settings/sms", label: "SMS", icon: Smartphone, exact: false },
  { href: "/admin/settings/integrations", label: "Integrations", icon: Plug, exact: false },
];

export function SettingsSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border/80 bg-muted/30 p-1"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
