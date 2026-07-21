"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, LineChart } from "lucide-react";

export function ClientSubnav({
  clientId,
  companyName,
}: {
  clientId: string;
  companyName: string;
}) {
  const pathname = usePathname();
  const tabs = [
    {
      href: `/admin/clients/${clientId}`,
      label: "Overview",
      icon: Building2,
      match: (p: string) => p === `/admin/clients/${clientId}`,
    },
    {
      href: `/admin/clients/${clientId}/insights`,
      label: "Insights",
      icon: LineChart,
      match: (p: string) => p.startsWith(`/admin/clients/${clientId}/insights`),
    },
  ];

  return (
    <div className="mb-6 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {companyName}
      </p>
      <nav
        className="flex gap-1 rounded-lg border border-border/80 bg-muted/30 p-1"
        aria-label="Client sections"
      >
        {tabs.map((tab) => {
          const active = tab.match(pathname);
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
    </div>
  );
}
