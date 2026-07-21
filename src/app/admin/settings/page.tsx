import { FormPanel } from "@/components/shared/form-panel";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, type SettingKey } from "@/lib/settings";
import { Settings } from "lucide-react";

const KEYS: SettingKey[] = ["app.name", "app.url", "app.supportEmail"];

export default async function GeneralSettingsPage() {
  const [appName, appUrl, supportEmail] = await getSettingsStatus(KEYS);

  return (
    <FormPanel
      title="General"
      description="Basic application configuration"
      icon={Settings}
    >
      <SettingsForm action={saveSettings.bind(null, KEYS)}>
        <SettingField
          status={appName}
          label="App name"
          placeholder="ClientHub"
          hint="Shown in emails and page titles."
        />
        <SettingField
          status={appUrl}
          label="App URL"
          type="url"
          placeholder="https://app.voixly.com"
          hint="Public URL of this app — used for payment redirects, email links, and Google OAuth callbacks."
        />
        <SettingField
          status={supportEmail}
          label="Support email"
          type="email"
          placeholder="support@voixly.com"
          hint="Where clients can reach you."
        />
      </SettingsForm>
    </FormPanel>
  );
}
