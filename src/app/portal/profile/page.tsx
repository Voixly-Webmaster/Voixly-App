import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { FormPanel } from "@/components/shared/form-panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOwnProfile } from "@/actions/clients";
import { User } from "lucide-react";

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
        <form action={updateOwnProfile} className="space-y-4">
          <div className="space-y-2">
            <Label>Company</Label>
            <Input value={client.companyName} disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={client.user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact name</Label>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={client.contactName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={client.address ?? ""} rows={3} />
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </FormPanel>
    </div>
  );
}
