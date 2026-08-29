import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session-guard";
import { AdminShell } from "@/components/layout/admin-shell";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Voixly operations hub — clients, invoices, support, tasks, and files.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AdminShell userName={user.name} isAdmin={user.role === "ADMIN"}>
      {children}
    </AdminShell>
  );
}
