"use client";

import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { updateOwnProfile } from "@/actions/clients";
import { Loader2 } from "lucide-react";

export function OwnProfileForm({
  companyName,
  email,
  contactName,
  phone,
  address,
}: {
  companyName: string;
  email: string;
  contactName: string;
  phone: string;
  address: string;
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await updateOwnProfile(formData);
            success("Profile saved", "Your contact details are up to date.");
          } catch (err) {
            error("Could not save profile", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label>Company</Label>
        <Input defaultValue={companyName} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input defaultValue={email} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactName">Contact name</Label>
        <Input
          id="contactName"
          name="contactName"
          defaultValue={contactName}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={phone} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={address}
          rows={3}
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
