"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { selectClassName } from "@/lib/ui";
import { updateClientProfile } from "@/actions/clients";

export function ClientProfileForm({
  clientId,
  companyName,
  contactName,
  phone,
  address,
  tier,
}: {
  clientId: string;
  companyName: string;
  contactName: string;
  phone: string;
  address: string;
  tier: string;
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const result = await updateClientProfile(formData);
            if ("error" in result) {
              error("Could not save profile", result.error);
              return;
            }
            success("Profile saved", "The customer details are up to date.");
          } catch (err) {
            error("Could not save profile", actionErrorMessage(err));
          }
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-2">
        <Label htmlFor="client-company">Company</Label>
        <Input id="client-company" name="companyName" defaultValue={companyName} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-contact">Contact</Label>
        <Input id="client-contact" name="contactName" defaultValue={contactName} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-phone">Phone</Label>
        <Input id="client-phone" name="phone" defaultValue={phone} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-address">Address</Label>
        <Textarea id="client-address" name="address" defaultValue={address} rows={2} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-tier">Tier</Label>
        <select
          id="client-tier"
          name="tier"
          className={selectClassName}
          defaultValue={tier}
          disabled={pending}
        >
          <option value="">None</option>
          <option value="PLATINUM">Platinum</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
          <option value="BRONZE">Bronze</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
