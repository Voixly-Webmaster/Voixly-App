"use client";

import {
  LayoutDashboard,
  CreditCard,
  MessageSquare,
  FolderKanban,
  Upload,
  Megaphone,
  User,
  LineChart,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPaletteProvider } from "@/components/shared/command-palette";

const baseNav = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/billing", label: "Billing", icon: CreditCard },
  { href: "/portal/support", label: "Support", icon: MessageSquare },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/files", label: "Files", icon: Upload },
  { href: "/portal/announcements", label: "Announcements", icon: Megaphone },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export function PortalShell({
  children,
  userName,
  showInsights = false,
}: {
  children: React.ReactNode;
  userName?: string | null;
  showInsights?: boolean;
}) {
  const navItems = showInsights
    ? [
        ...baseNav.slice(0, 4),
        { href: "/portal/insights", label: "Insights", icon: LineChart },
        ...baseNav.slice(4),
      ]
    : baseNav;

  return (
    <CommandPaletteProvider>
      <AppShell
        navItems={navItems}
        title="Voixly"
        subtitle="ClientHub"
        userName={userName}
        userRole="CLIENT"
        searchPlaceholder="Search invoices, tickets, projects..."
      >
        {children}
      </AppShell>
    </CommandPaletteProvider>
  );
}
