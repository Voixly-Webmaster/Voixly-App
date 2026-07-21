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

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/billing", label: "Billing", icon: CreditCard },
  { href: "/portal/support", label: "Support", icon: MessageSquare },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/insights", label: "Insights", icon: LineChart },
  { href: "/portal/files", label: "Files", icon: Upload },
  { href: "/portal/announcements", label: "Announcements", icon: Megaphone },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export function PortalShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  return (
    <AppShell
      navItems={navItems}
      title="ClientHub"
      subtitle="Client Portal"
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
