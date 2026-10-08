import type { Metadata } from "next";
import { FormPanel } from "@/components/shared/form-panel";
import { AlertBanner } from "@/components/shared/alert-banner";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, type SettingKey } from "@/lib/settings";
import { Mail } from "lucide-react";

import { TestEmailButton } from "@/components/settings/test-email-button";

export const metadata: Metadata = {
  title: "Email",
  description: "Resend delivery settings and notification sender address.",
};

const KEYS: SettingKey[] = ["resend.apiKey", "resend.fromEmail"];

export default async function EmailSettingsPage() {
  const [apiKey, fromEmail] = await getSettingsStatus(KEYS);

  return (
    <FormPanel
      title="Email (Resend)"
      description="Invoices, ticket replies, password resets, and email sign-in codes"
      icon={Mail}
    >
      {!apiKey.isSet && (
        <AlertBanner variant="info" className="mb-4">
          No API key set — emails are currently logged to the server console
          instead of being sent.
        </AlertBanner>
      )}
      <SettingsForm action={saveSettings.bind(null, KEYS)}>
        <SettingField
          status={apiKey}
          label="Resend API key"
          placeholder="re_..."
          hint="Create one at resend.com → API Keys. Stored encrypted."
        />
        <SettingField
          status={fromEmail}
          label="From address"
          placeholder="ClientHub <notifications@yourdomain.com>"
          hint="Must be a verified domain in Resend."
        />
      </SettingsForm>
      {apiKey.isSet && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <TestEmailButton />
        </div>
      )}
    </FormPanel>
  );
}
