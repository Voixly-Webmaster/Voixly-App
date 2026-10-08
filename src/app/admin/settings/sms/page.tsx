import type { Metadata } from "next";
import { FormPanel } from "@/components/shared/form-panel";
import { AlertBanner } from "@/components/shared/alert-banner";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { TestSmsButton } from "@/components/settings/test-sms-button";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, type SettingKey } from "@/lib/settings";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "SMS",
  description: "VoidFix settings for texts to clients.",
};

const KEYS: SettingKey[] = ["voidfix.apiKey", "voidfix.deviceId"];

export default async function SmsSettingsPage() {
  const [apiKey, deviceId] = await getSettingsStatus(KEYS);

  return (
    <FormPanel
      title="SMS (VoidFix)"
      description="Sign-in codes, announcements, invoices, ticket replies, and failed payments"
      icon={Smartphone}
    >
      {!apiKey.isSet && (
        <AlertBanner variant="info" className="mb-4">
          No API key set — in local development, texts are printed in the server
          console instead of being sent.
        </AlertBanner>
      )}
      <div className="mb-5 space-y-2 text-sm text-muted-foreground">
        <p>
          Sign in at{" "}
          <a
            href="https://sms.voidfix.com/configuration.php#api"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            VoidFix → API & Settings
          </a>{" "}
          and copy the API key. Leave the device ID blank to use your primary
          phone.
        </p>
      </div>
      <SettingsForm action={saveSettings.bind(null, KEYS)}>
        <SettingField
          status={apiKey}
          label="API key"
          placeholder="Your VoidFix API key"
          hint="Stored encrypted."
        />
        <SettingField
          status={deviceId}
          label="Device ID"
          placeholder="12"
          hint="Optional. The phone ID from VoidFix → Devices."
        />
      </SettingsForm>
      {apiKey.isSet && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <TestSmsButton />
        </div>
      )}
    </FormPanel>
  );
}
