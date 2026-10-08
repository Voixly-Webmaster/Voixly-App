import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AccountSecurity } from "@/components/auth/account-security";

export const metadata: Metadata = {
  title: "Security",
  description: "Password and sign-in codes for your account.",
};

export default async function AdminSecurityPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Update your password and turn on a sign-in code by email or text"
      />
      <AccountSecurity />
    </div>
  );
}
