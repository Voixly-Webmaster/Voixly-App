import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { FormPanel } from "@/components/shared/form-panel";
import { OwnProfileForm } from "@/components/clients/own-profile-form";
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
        <OwnProfileForm
          companyName={client.companyName}
          email={client.user.email}
          contactName={client.contactName ?? ""}
          phone={client.phone ?? ""}
          address={client.address ?? ""}
        />
      </FormPanel>
    </div>
  );
}
