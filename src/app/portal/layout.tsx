import { requireClient } from "@/lib/session-guard";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();
  return <PortalShell userName={user.name}>{children}</PortalShell>;
}
