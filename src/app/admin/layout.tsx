import { requireAdmin } from "@/lib/session-guard";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return <AdminShell userName={user.name}>{children}</AdminShell>;
}
