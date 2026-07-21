import { google } from "googleapis";
import { prisma } from "@/lib/db";
import {
  GOOGLE_INSIGHTS_SCOPES,
  googleRedirectUri,
  getGoogleOAuthCredentials,
  encodeOAuthState,
} from "@/lib/google/config";

export async function createOAuth2Client() {
  const credentials = await getGoogleOAuthCredentials();
  if (!credentials) {
    throw new Error(
      "Google OAuth is not configured. Add credentials in Admin → Settings → Integrations."
    );
  }
  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    await googleRedirectUri()
  );
}

export async function getGoogleAuthUrl(clientId: string): Promise<string> {
  const oauth2 = await createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_INSIGHTS_SCOPES,
    state: encodeOAuthState(clientId),
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = await createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("Google did not return tokens. Try disconnecting and reconnecting.");
  }
  oauth2.setCredentials(tokens);

  let googleEmail: string | null = null;
  try {
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    googleEmail = data.email ?? null;
  } catch {
    // non-fatal
  }

  return { tokens, googleEmail };
}

type IntegrationRecord = {
  id: string;
  clientId: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
};

/** Returns an OAuth2 client with a valid access token, persisting refreshes. */
export async function getAuthenticatedClient(integration: IntegrationRecord) {
  const oauth2 = await createOAuth2Client();
  oauth2.setCredentials({
    refresh_token: integration.refreshToken,
    access_token: integration.accessToken ?? undefined,
    expiry_date: integration.expiresAt?.getTime(),
  });

  const needsRefresh =
    !integration.accessToken ||
    !integration.expiresAt ||
    integration.expiresAt.getTime() < Date.now() + 60_000;

  if (needsRefresh) {
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);

    await prisma.clientGoogleIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: credentials.access_token ?? integration.accessToken,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
        ...(credentials.refresh_token
          ? { refreshToken: credentials.refresh_token }
          : {}),
      },
    });
  }

  return oauth2;
}

export type GaPropertyOption = { id: string; name: string; account: string };
export type GscSiteOption = { siteUrl: string; permissionLevel: string };

export async function listGa4Properties(
  integration: IntegrationRecord
): Promise<GaPropertyOption[]> {
  const auth = await getAuthenticatedClient(integration);
  const admin = google.analyticsadmin({ version: "v1beta", auth });
  const properties: GaPropertyOption[] = [];

  let pageToken: string | undefined;
  do {
    const res = await admin.accountSummaries.list({
      pageSize: 200,
      pageToken,
    });
    for (const summary of res.data.accountSummaries ?? []) {
      for (const prop of summary.propertySummaries ?? []) {
        if (!prop.property || !prop.displayName) continue;
        const id = prop.property.replace(/^properties\//, "");
        properties.push({
          id,
          name: prop.displayName,
          account: summary.displayName ?? summary.account ?? "Account",
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return properties.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSearchConsoleSites(
  integration: IntegrationRecord
): Promise<GscSiteOption[]> {
  const auth = await getAuthenticatedClient(integration);
  const sc = google.searchconsole({ version: "v1", auth });
  const res = await sc.sites.list();
  return (res.data.siteEntry ?? [])
    .filter((s) => s.siteUrl)
    .map((s) => ({
      siteUrl: s.siteUrl!,
      permissionLevel: s.permissionLevel ?? "unknown",
    }))
    .sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
}

export type Ga4Metrics = {
  activeUsers: number;
  sessions: number;
  pageViews: number;
  engagementRate: number;
  daily: { date: string; activeUsers: number; sessions: number }[];
  topPages: { path: string; views: number }[];
};

export async function fetchGa4Metrics(
  integration: IntegrationRecord,
  propertyId: string,
  days = 28
): Promise<Ga4Metrics> {
  const auth = await getAuthenticatedClient(integration);
  const analytics = google.analyticsdata({ version: "v1beta", auth });

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [summaryRes, dailyRes, pagesRes] = await Promise.all([
    analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: fmt(start), endDate: fmt(end) }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
        ],
      },
    }),
    analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: fmt(start), endDate: fmt(end) }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
    }),
    analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: fmt(start), endDate: fmt(end) }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "10",
      },
    }),
  ]);

  const sm = summaryRes.data.rows?.[0]?.metricValues ?? [];
  const num = (i: number) => parseFloat(sm[i]?.value ?? "0");

  return {
    activeUsers: Math.round(num(0)),
    sessions: Math.round(num(1)),
    pageViews: Math.round(num(2)),
    engagementRate: Math.round(num(3) * 1000) / 10,
    daily: (dailyRes.data.rows ?? []).map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? "",
      activeUsers: Math.round(parseFloat(row.metricValues?.[0]?.value ?? "0")),
      sessions: Math.round(parseFloat(row.metricValues?.[1]?.value ?? "0")),
    })),
    topPages: (pagesRes.data.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "/",
      views: Math.round(parseFloat(row.metricValues?.[0]?.value ?? "0")),
    })),
  };
}

export type GscMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number }[];
};

export async function fetchSearchConsoleMetrics(
  integration: IntegrationRecord,
  siteUrl: string,
  days = 28
): Promise<GscMetrics> {
  const auth = await getAuthenticatedClient(integration);
  const sc = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const dateRange = { startDate: fmt(start), endDate: fmt(end) };

  const [summaryRes, queriesRes, pagesRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate },
    }),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ["query"],
        rowLimit: 10,
      },
    }),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ["page"],
        rowLimit: 10,
      },
    }),
  ]);

  const summaryRows = summaryRes.data.rows ?? [];
  const totalClicks = summaryRows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalImpressions = summaryRows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgCtr =
    summaryRows.length > 0
      ? summaryRows.reduce((s, r) => s + (r.ctr ?? 0), 0) / summaryRows.length
      : 0;
  const avgPosition =
    summaryRows.length > 0
      ? summaryRows.reduce((s, r) => s + (r.position ?? 0), 0) / summaryRows.length
      : 0;

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr: Math.round(avgCtr * 10000) / 100,
    position: Math.round(avgPosition * 10) / 10,
    topQueries: (queriesRes.data.rows ?? []).map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: Math.round((r.ctr ?? 0) * 10000) / 100,
      position: Math.round((r.position ?? 0) * 10) / 10,
    })),
    topPages: (pagesRes.data.rows ?? []).map((r) => ({
      page: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    })),
  };
}
