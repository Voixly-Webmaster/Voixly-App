import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/shared/alert-banner";
import { isGoogleInsightsConfigured } from "@/lib/google/config";
import { BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";

export async function InsightsConnectPanel({
  clientId,
  connected,
  googleEmail,
  error,
  connectedFlash,
}: {
  clientId: string;
  connected: boolean;
  googleEmail?: string | null;
  error?: string | null;
  connectedFlash?: boolean;
}) {
  const configured = await isGoogleInsightsConfigured();

  return (
    <Panel
      title="Google Analytics & Search Console"
      description="Connect a Google account that has access to this client's properties"
      icon={BarChart3}
      accent="primary"
    >
      {connectedFlash && (
        <AlertBanner className="mb-4">
          Google connected successfully. Select a GA4 property and Search Console site below.
        </AlertBanner>
      )}

      {error === "not_configured" && (
        <AlertBanner variant="warning" className="mb-4">
          Google OAuth is not configured. Add your Google client ID and secret in{" "}
          <Link href="/admin/settings/integrations" className="font-medium underline">
            Settings → Integrations
          </Link>
          .
        </AlertBanner>
      )}

      {error === "google_callback" && (
        <AlertBanner variant="warning" className="mb-4">
          Could not complete Google sign-in. Please try again.
        </AlertBanner>
      )}

      {error === "no_refresh_token" && (
        <AlertBanner variant="warning" className="mb-4">
          Google did not return a refresh token. Disconnect the app in your Google Account
          settings and reconnect.
        </AlertBanner>
      )}

      {!configured ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            To enable Insights, create OAuth credentials in{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Cloud Console
            </a>
            :
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Enable <strong>Google Analytics Data API</strong>, <strong>Google Analytics Admin API</strong>, and <strong>Search Console API</strong></li>
            <li>Create an OAuth 2.0 Web client</li>
            <li>Add redirect URI: <code className="text-xs">{process.env.APP_URL ?? "http://localhost:3031"}/api/integrations/google/callback</code></li>
            <li>
              Paste the client ID and secret in{" "}
              <Link href="/admin/settings/integrations" className="font-medium text-primary hover:underline">
                Settings → Integrations
              </Link>
            </li>
          </ol>
        </div>
      ) : connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Connected</p>
            {googleEmail && (
              <p className="text-sm text-muted-foreground">{googleEmail}</p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/integrations/google/connect?clientId=${clientId}`}>
              Reconnect
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground max-w-lg">
            Sign in with the Google account that manages this client&apos;s Analytics and
            Search Console. Voixly staff only — read-only access.
          </p>
          <Button asChild>
            <a href={`/api/integrations/google/connect?clientId=${clientId}`}>
              <ExternalLink className="h-4 w-4" />
              Connect Google
            </a>
          </Button>
        </div>
      )}
    </Panel>
  );
}
