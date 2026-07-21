import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { InsightsConnectPanel } from "@/components/insights/insights-connect-panel";
import { InsightsPropertyForm } from "@/components/insights/insights-property-form";
import { InsightsMetricsView } from "@/components/insights/insights-metrics";
import { AlertBanner } from "@/components/shared/alert-banner";
import { Button } from "@/components/ui/button";
import { loadInsightsData } from "@/lib/insights/load";

export default async function AdminClientInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!(await canAccessClient(user, id))) notFound();

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: { user: true, googleIntegration: true },
  });
  if (!client) notFound();

  const integration = client.googleIntegration;
  let insightsData = null;
  if (integration) {
    insightsData = await loadInsightsData(integration);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description={`Google Analytics & Search Console for ${client.companyName}`}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/clients/${id}`}>← Overview</Link>
          </Button>
        }
      />

      <InsightsConnectPanel
        clientId={id}
        connected={!!integration}
        googleEmail={integration?.googleEmail}
        error={sp.error ?? null}
        connectedFlash={sp.connected === "1"}
      />

      {integration && insightsData && (
        <>
          <InsightsPropertyForm
            clientId={id}
            gaProperties={insightsData.gaProperties}
            gscSites={insightsData.gscSites}
            current={{
              gaPropertyId: integration.gaPropertyId,
              gaPropertyName: integration.gaPropertyName,
              searchConsoleSite: integration.searchConsoleSite,
              clientVisible: integration.clientVisible,
            }}
          />

          {(insightsData.ga4Error || insightsData.gscError) && (
            <div className="space-y-2">
              {insightsData.ga4Error && (
                <AlertBanner variant="warning">{insightsData.ga4Error}</AlertBanner>
              )}
              {insightsData.gscError && (
                <AlertBanner variant="warning">{insightsData.gscError}</AlertBanner>
              )}
            </div>
          )}

          <InsightsMetricsView
            ga4={insightsData.ga4}
            gsc={insightsData.gsc}
            gaPropertyName={integration.gaPropertyName}
            searchConsoleSite={integration.searchConsoleSite}
          />
        </>
      )}
    </div>
  );
}
