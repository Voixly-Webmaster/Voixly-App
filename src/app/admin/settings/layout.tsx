import type { Metadata } from "next";
import { requireAdminRole } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSubnav } from "@/components/settings/settings-subnav";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage users, products, payments, email, texts, and message wording.",
};

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
        description="Manage users, products, payment providers, email, texts, and message wording"
        className="mb-6"
      />
      <SettingsSubnav />
      {children}
    </div>
  );
}
