import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { InsightsMetricsView } from "@/components/insights/insights-metrics";
import { EmptyState } from "@/components/shared/empty-state";
import { loadInsightsData } from "@/lib/insights/load";
import { LineChart } from "lucide-react";

export const metadata: Metadata = {
  title: "Insights",
  description: "Analytics and Search Console performance shared by Voixly.",
};

export default async function PortalInsightsPage() {
  const user = await requireClient();
  const clientId = user.clientId!;

  const integration = await prisma.clientGoogleIntegration.findFirst({
    where: {
      clientId,
      clientVisible: true,
    },
  });

  if (!integration || (!integration.gaPropertyId && !integration.searchConsoleSite)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          description="Website performance from Google Analytics and Search Console"
        />
        <EmptyState
          icon={LineChart}
          title="Insights not available yet"
          description="Your Voixly team will connect analytics and share reports here when ready."
        />
      </div>
    );
  }

  const insightsData = await loadInsightsData(integration);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Website performance — last 28 days"
      />
      <InsightsMetricsView
        ga4={insightsData.ga4}
        gsc={insightsData.gsc}
        gaPropertyName={integration.gaPropertyName}
        searchConsoleSite={integration.searchConsoleSite}
        readOnly
      />
    </div>
  );
}
