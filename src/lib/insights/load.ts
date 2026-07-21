import {
  fetchGa4Metrics,
  fetchSearchConsoleMetrics,
  listGa4Properties,
  listSearchConsoleSites,
  type Ga4Metrics,
  type GscMetrics,
  type GaPropertyOption,
  type GscSiteOption,
} from "@/lib/google/client";
import type { ClientGoogleIntegration } from "@prisma/client";

export type InsightsData = {
  gaProperties: GaPropertyOption[];
  gscSites: GscSiteOption[];
  ga4: Ga4Metrics | null;
  gsc: GscMetrics | null;
  ga4Error: string | null;
  gscError: string | null;
};

export async function loadInsightsData(
  integration: ClientGoogleIntegration,
  days = 28
): Promise<InsightsData> {
  let gaProperties: GaPropertyOption[] = [];
  let gscSites: GscSiteOption[] = [];
  let ga4: Ga4Metrics | null = null;
  let gsc: GscMetrics | null = null;
  let ga4Error: string | null = null;
  let gscError: string | null = null;

  try {
    [gaProperties, gscSites] = await Promise.all([
      listGa4Properties(integration),
      listSearchConsoleSites(integration),
    ]);
  } catch (err) {
    console.error("[insights] list properties", err);
  }

  if (integration.gaPropertyId) {
    try {
      ga4 = await fetchGa4Metrics(integration, integration.gaPropertyId, days);
    } catch (err) {
      ga4Error = err instanceof Error ? err.message : "Failed to load Analytics data";
      console.error("[insights] ga4", err);
    }
  }

  if (integration.searchConsoleSite) {
    try {
      gsc = await fetchSearchConsoleMetrics(
        integration,
        integration.searchConsoleSite,
        days
      );
    } catch (err) {
      gscError = err instanceof Error ? err.message : "Failed to load Search Console data";
      console.error("[insights] gsc", err);
    }
  }

  return { gaProperties, gscSites, ga4, gsc, ga4Error, gscError };
}
