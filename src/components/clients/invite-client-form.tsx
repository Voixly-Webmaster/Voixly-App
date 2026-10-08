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
import { inviteClient } from "@/actions/invites";

export function InviteClientForm({
  products,
}: {
  products: { id: string; label: string }[];
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tier, setTier] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an active product in Settings → Products before inviting a customer.
        The product becomes their service and their first invoice.
      </p>
    );
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData();
        formData.set("name", name);
        formData.set("email", email);
        formData.set("companyName", companyName);
        formData.set("tier", tier);
        formData.set("productId", productId);
        startTransition(async () => {
          try {
            const result = await inviteClient(formData);
            if ("error" in result) {
              error("Could not send invite", result.error);
              return;
            }
            success(
              "Invite sent",
              result.emailSent
                ? `${email} can set up their account from the email. Their first invoice is ready.`
                : "The customer and invoice were created, but the email did not send. Open the client and resend the invite."
            );
            setName("");
            setEmail("");
            setCompanyName("");
            setTier("");
            setProductId(products[0]?.id ?? "");
            router.refresh();
          } catch (err) {
            error("Could not send invite", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="invite-name">Name</Label>
        <Input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={pending}
          placeholder="Jordan Lee"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
          placeholder="jordan@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-company">Company</Label>
        <Input
          id="invite-company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          disabled={pending}
          placeholder="Acme Co."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-tier">Tier</Label>
        <select
          id="invite-tier"
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
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="invite-product">Product</Label>
        <select
          id="invite-product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className={selectClassName}
          required
          disabled={pending}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Send invite
        </Button>
      </div>
    </form>
  );
}
