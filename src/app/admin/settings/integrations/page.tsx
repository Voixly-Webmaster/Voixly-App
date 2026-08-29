import type { Metadata } from "next";
import { FormPanel } from "@/components/shared/form-panel";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, getSetting, type SettingKey } from "@/lib/settings";
import { Plug } from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect Google Analytics and Search Console for client insights.",
};

const KEYS: SettingKey[] = ["google.clientId", "google.clientSecret"];

export default async function IntegrationsSettingsPage() {
  const [clientId, clientSecret] = await getSettingsStatus(KEYS);
  const appUrl = (await getSetting("app.url")) ?? "http://localhost:3031";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/integrations/google/callback`;

  return (
    <FormPanel
      title="Google (Analytics & Search Console)"
      description="OAuth credentials that power the client Insights tab"
      icon={Plug}
    >
      <div className="mb-5 space-y-2 text-sm text-muted-foreground">
        <p>
          Create an OAuth 2.0 Web client in the{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Google Cloud Console
          </a>{" "}
          with this redirect URI:
        </p>
        <code className="block w-fit rounded-md bg-muted px-2.5 py-1.5 text-xs">
          {redirectUri}
        </code>
        <p>
          Enable the <strong>Analytics Data API</strong>,{" "}
          <strong>Analytics Admin API</strong>, and <strong>Search Console API</strong>.
        </p>
      </div>
      <SettingsForm action={saveSettings.bind(null, KEYS)}>
        <SettingField
          status={clientId}
          label="Client ID"
          placeholder="1234567890-xxxx.apps.googleusercontent.com"
        />
        <SettingField
          status={clientSecret}
          label="Client secret"
          placeholder="GOCSPX-..."
          hint="Stored encrypted."
        />
      </SettingsForm>
    </FormPanel>
  );
}
