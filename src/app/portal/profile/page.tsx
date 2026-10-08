import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { FormPanel } from "@/components/shared/form-panel";
import { OwnProfileForm } from "@/components/clients/own-profile-form";
import { ClientLogo } from "@/components/clients/client-logo";
import { AccountSecurity } from "@/components/auth/account-security";
import { User } from "lucide-react";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your company contact details on file with Voixly.",
};

export default async function PortalProfilePage() {
  const user = await requireClient();
  const client = await prisma.client.findUnique({
    where: { id: user.clientId! },
    include: { user: true },
  });

  if (!client) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Update your contact information" />
      <FormPanel
        title="Contact details"
        description="Company and email are managed by your account team"
        icon={User}
        className="max-w-lg"
      >
        <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-5">
          <ClientLogo
            clientId={client.id}
            name={client.companyName}
            logoFileName={client.logoFileName}
            size="lg"
          />
          <div>
            <p className="text-sm font-medium">{client.companyName}</p>
            <p className="text-xs text-muted-foreground">
              Your account team sets the logo.
            </p>
          </div>
        </div>
        <OwnProfileForm
          companyName={client.companyName}
          email={client.user.email}
          contactName={client.contactName ?? ""}
          phone={client.phone ?? ""}
          address={client.address ?? ""}
        />
      </FormPanel>
      <AccountSecurity />
    </div>
  );
}
