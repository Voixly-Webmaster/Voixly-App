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
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/invoices", label: "Invoices", icon: CreditCard },
  { href: "/admin/tickets", label: "Support", icon: MessageSquare },
  { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/admin/files", label: "Files", icon: Upload },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/activity", label: "Activity", icon: Activity },
];

export function AdminShell({
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
      subtitle="Operations"
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
