import type { Metadata } from "next";
import Link from "next/link";
import { FormPanel } from "@/components/shared/form-panel";
import { AlertBanner } from "@/components/shared/alert-banner";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingField } from "@/components/settings/setting-field";
import { TestSmsButton } from "@/components/settings/test-sms-button";
import { saveSettings } from "@/actions/settings";
import { getSettingsStatus, type SettingKey } from "@/lib/settings";
import { getAppUrl } from "@/lib/app-url";
import { listVoidfixDevices } from "@/lib/sms";
import { currentVoidfixWebhook } from "@/lib/sms-inbox";
import { SmsInboxButton } from "@/components/settings/sms-inbox-button";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "SMS",
  description: "VoidFix settings for texts to clients.",
};

const KEYS: SettingKey[] = ["voidfix.apiKey", "voidfix.deviceId"];

function simSummary(slot: number, label: string, number: string | null): string {
  const name = slot === 0 ? "SIM 1" : "SIM 2";
  if (number) return `${name} ${number}`;
  return `${name} (${label})`;
}

export default async function SmsSettingsPage() {
  const [apiKey, deviceId] = await getSettingsStatus(KEYS);
  const phones = apiKey.isSet ? await listVoidfixDevices() : null;
  const appUrl = await getAppUrl();
  const inboxUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/voidfix`;
  const currentWebhook = apiKey.isSet ? await currentVoidfixWebhook() : null;

  return (
    <FormPanel
      title="SMS (VoidFix)"
      description="Sign-in codes, announcements, invoices, ticket replies, and failed payments"
      icon={Smartphone}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Edit invoice, ticket, announcement, and sign-in texts in{" "}
        <Link href="/admin/settings/messages" className="font-medium text-primary hover:underline">
          Messages
        </Link>
        .
      </p>
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
          phone. A saved ID uses SIM 1 unless that slot is empty, in which case
          the SIM that has a number is used.
        </p>
      </div>
      {phones && !phones.ok && (
        <AlertBanner variant="warning" className="mb-4">
          {phones.error}
        </AlertBanner>
      )}
      {phones?.ok && phones.devices.length === 0 && (
        <AlertBanner variant="warning" className="mb-4">
          VoidFix accepted the API key, and no phones are connected.
        </AlertBanner>
      )}
      {phones?.ok && phones.devices.length > 0 && (
        <div className="mb-5 space-y-1 text-sm text-muted-foreground">
          {phones.devices.map((phone) => (
            <p key={phone.id}>
              <span className="font-medium text-foreground">
                {phone.name ?? phone.model ?? "Phone"} ({phone.id})
              </span>
              {phone.sims.length > 0
                ? ` — ${phone.sims.map((sim) => simSummary(sim.slot, sim.label, sim.number)).join(", ")}`
                : " — connected, no SIM listed"}
            </p>
          ))}
        </div>
      )}
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
          hint="Optional. The phone ID from VoidFix → Devices, such as 1383. Add |1 to use SIM 2, for example 1383|1."
        />
      </SettingsForm>
      <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Text inbox</p>
          <p>
            Customer replies show up in Texts, matched to the phone number on
            their account. VoidFix should send them to{" "}
            <span className="break-all font-medium text-foreground">{inboxUrl}</span>.
          </p>
          {apiKey.isSet && currentWebhook === inboxUrl ? (
            <p>This inbox is receiving texts.</p>
          ) : apiKey.isSet && currentWebhook ? (
            <p>VoidFix is currently sending texts to a different address.</p>
          ) : (
            <p>Turn this on so replies land in the inbox.</p>
          )}
        </div>
        {apiKey.isSet ? (
          <>
            <SmsInboxButton />
            <TestSmsButton />
          </>
        ) : null}
      </div>
    </FormPanel>
  );
}
