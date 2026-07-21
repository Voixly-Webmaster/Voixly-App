import { FormPanel } from "@/components/shared/form-panel";
import { AlertBanner } from "@/components/shared/alert-banner";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, getSetting, type SettingKey } from "@/lib/settings";
import { CreditCard } from "lucide-react";

const KEYS: SettingKey[] = [
  "stripe.secretKey",
  "stripe.publishableKey",
  "stripe.webhookSecret",
];

export default async function PaymentSettingsPage() {
  const [secretKey, publishableKey, webhookSecret] = await getSettingsStatus(KEYS);
  const appUrl =
    (await getSetting("app.url")) ?? "https://your-domain.com";
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/stripe`;

  const configured = secretKey.isSet;

  return (
    <div className="space-y-6">
      <FormPanel
        title="Stripe"
        description="API keys for invoicing and checkout — find them in your Stripe dashboard under Developers → API keys"
        icon={CreditCard}
      >
        {!configured && (
          <AlertBanner variant="warning" className="mb-4">
            Stripe is not configured yet. Clients won&apos;t be able to pay invoices
            until a secret key is added.
          </AlertBanner>
        )}
        <SettingsForm action={saveSettings.bind(null, KEYS)}>
          <SettingField
            status={secretKey}
            label="Secret key"
            placeholder="sk_live_..."
            hint="Used server-side to create checkout sessions and customers. Stored encrypted."
          />
          <SettingField
            status={publishableKey}
            label="Publishable key"
            placeholder="pk_live_..."
          />
          <SettingField
            status={webhookSecret}
            label="Webhook signing secret"
            placeholder="whsec_..."
            hint={`Create a webhook endpoint pointing to ${webhookUrl}. Include: checkout.session.completed, checkout.session.expired, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted. Stored encrypted.`}
          />
        </SettingsForm>
      </FormPanel>
    </div>
  );
}
