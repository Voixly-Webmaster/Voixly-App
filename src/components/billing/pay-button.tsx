"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/actions/invoices";
import { useToast } from "@/components/providers/toast-provider";
import { actionErrorMessage } from "@/lib/action-error";
import { Loader2 } from "lucide-react";

export function PayNowButton({
  invoiceId,
  recurring = false,
}: {
  invoiceId: string;
  /** First payment starts a Stripe subscription */
  recurring?: boolean;
}) {
  const { error } = useToast();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { url } = await createCheckoutSession(invoiceId);
          if (!url) throw new Error("Stripe did not return a checkout link");
          window.location.href = url;
        } catch (err) {
          setLoading(false);
          error("Could not start payment", actionErrorMessage(err));
        }
      }}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {loading ? "Opening checkout…" : recurring ? "Subscribe & pay" : "Pay now"}
    </Button>
  );
}
