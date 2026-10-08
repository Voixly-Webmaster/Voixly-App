"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { selectClassName } from "@/lib/ui";
import { createClient } from "@/actions/clients";

export function CreateClientForm() {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState("");

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData();
        formData.set("companyName", companyName);
        formData.set("contactName", contactName);
        formData.set("email", email);
        formData.set("phone", phone);
        formData.set("password", password);
        formData.set("tier", tier);
        startTransition(async () => {
          try {
            const result = await createClient(formData);
            if ("error" in result) {
              error("Could not add client", result.error);
              return;
            }
            success(
              "Client added",
              result.welcomeSent
                ? "A welcome email is on its way. Share the password with them separately."
                : "The account was created, but the welcome email did not send. Share the password with them separately."
            );
            setCompanyName("");
            setContactName("");
            setEmail("");
            setPhone("");
            setPassword("");
            setTier("");
            router.refresh();
          } catch (err) {
            error("Could not add client", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="new-client-company">Company</Label>
        <Input
          id="new-client-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client-contact">Contact name</Label>
        <Input
          id="new-client-contact"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client-email">Email</Label>
        <Input
          id="new-client-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client-phone">Phone</Label>
        <Input
          id="new-client-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client-password">Password</Label>
        <Input
          id="new-client-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-client-tier">Tier</Label>
        <select
          id="new-client-tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className={selectClassName}
          disabled={pending}
        >
          <option value="">None</option>
          <option value="PLATINUM">Platinum</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
          <option value="BRONZE">Bronze</option>
        </select>
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-1">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Create client
        </Button>
      </div>
    </form>
  );
}
