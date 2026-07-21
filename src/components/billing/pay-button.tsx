"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/actions/invoices";

export function PayNowButton({
  invoiceId,
  recurring = false,
}: {
  invoiceId: string;
  /** First payment starts a Stripe subscription */
  recurring?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { url } = await createCheckoutSession(invoiceId);
          if (url) window.location.href = url;
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading
        ? "Loading..."
        : recurring
          ? "Subscribe & pay"
          : "Pay now"}
    </Button>
  );
}
