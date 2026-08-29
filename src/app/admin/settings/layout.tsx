import { requireAdminRole } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSubnav } from "@/components/settings/settings-subnav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminRole();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage users, products, payment providers, email, and integrations"
        className="mb-6"
      />
      <SettingsSubnav />
      {children}
    </div>
  );
}
