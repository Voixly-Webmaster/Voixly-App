"use client";

import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  CheckSquare,
  Upload,
  Megaphone,
  Activity,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPaletteProvider } from "@/components/shared/command-palette";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/invoices", label: "Invoices", icon: CreditCard },
  { href: "/admin/tickets", label: "Support", icon: MessageSquare },
  { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/admin/files", label: "Files", icon: Upload },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
];

export function AdminShell({
  children,
  userName,
  isAdmin = false,
}: {
  children: React.ReactNode;
  userName?: string | null;
  isAdmin?: boolean;
}) {
  const items = isAdmin
    ? [...navItems, { href: "/admin/settings", label: "Settings", icon: Settings }]
    : navItems;

  return (
    <CommandPaletteProvider>
      <AppShell
        navItems={items}
        title="ClientHub"
        subtitle="Operations"
        userName={userName}
        userRole={isAdmin ? "ADMIN" : "STAFF"}
        searchPlaceholder="Search clients, invoices, tickets..."
      >
        {children}
      </AppShell>
    </CommandPaletteProvider>
  );
}
