import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { Ga4Metrics, GscMetrics } from "@/lib/google/client";
import {
  Users,
  MousePointerClick,
  Eye,
  TrendingUp,
  Search,
  BarChart3,
} from "lucide-react";

export function InsightsMetricsView({
  ga4,
  gsc,
  gaPropertyName,
  searchConsoleSite,
  days = 28,
  readOnly = false,
}: {
  ga4: Ga4Metrics | null;
  gsc: GscMetrics | null;
  gaPropertyName?: string | null;
  searchConsoleSite?: string | null;
  days?: number;
  readOnly?: boolean;
}) {
  const hasGa = ga4 !== null;
  const hasGsc = gsc !== null;

  if (!hasGa && !hasGsc) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No metrics yet"
        description={
          readOnly
            ? "Your team hasn't published insights for your account yet."
            : "Connect Google and select a GA4 property and Search Console site."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Last {days} days
        {gaPropertyName && <> · GA4: <span className="text-foreground">{gaPropertyName}</span></>}
        {searchConsoleSite && <> · GSC: <span className="text-foreground">{searchConsoleSite}</span></>}
      </p>

      {hasGa && ga4 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Google Analytics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active users" value={ga4.activeUsers.toLocaleString()} icon={Users} />
            <StatCard label="Sessions" value={ga4.sessions.toLocaleString()} icon={MousePointerClick} accent="secondary" />
            <StatCard label="Page views" value={ga4.pageViews.toLocaleString()} icon={Eye} />
            <StatCard label="Engagement rate" value={`${ga4.engagementRate}%`} icon={TrendingUp} accent="neutral" />
          </div>

          {ga4.daily.length > 0 && (
            <Panel title="Traffic trend" accent="none">
              <div className="overflow-x-auto">
                <div className="flex h-32 items-end gap-0.5 min-w-[400px]">
                  {ga4.daily.map((d) => {
                    const max = Math.max(...ga4.daily.map((x) => x.sessions), 1);
                    const h = Math.max(4, (d.sessions / max) * 100);
                    return (
                      <div
                        key={d.date}
                        className="group flex flex-1 flex-col items-center justify-end"
                        title={`${d.date}: ${d.sessions} sessions`}
                      >
                        <div
                          className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{ga4.daily[0]?.date}</span>
                  <span>{ga4.daily[ga4.daily.length - 1]?.date}</span>
                </div>
              </div>
            </Panel>
          )}

          {ga4.topPages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Top pages</h3>
              <DataTable headers={["Page", "Views"]}>
                {ga4.topPages.map((p) => (
                  <DataTableRow key={p.path}>
                    <DataTableCell className="max-w-md truncate font-mono text-xs">
                      {p.path}
                    </DataTableCell>
                    <DataTableCell className="tabular-nums">{p.views.toLocaleString()}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTable>
            </div>
          )}
        </section>
      )}

      {hasGsc && gsc && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Search Console</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Clicks" value={gsc.clicks.toLocaleString()} icon={MousePointerClick} />
            <StatCard label="Impressions" value={gsc.impressions.toLocaleString()} icon={Eye} accent="secondary" />
            <StatCard label="Avg. CTR" value={`${gsc.ctr}%`} icon={TrendingUp} />
            <StatCard label="Avg. position" value={gsc.position} icon={Search} accent="neutral" />
          </div>

          {gsc.topQueries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Top queries</h3>
              <DataTable headers={["Query", "Clicks", "Impressions", "CTR", "Position"]}>
                {gsc.topQueries.map((q) => (
                  <DataTableRow key={q.query}>
                    <DataTableCell className="max-w-xs truncate font-medium">{q.query}</DataTableCell>
                    <DataTableCell className="tabular-nums">{q.clicks}</DataTableCell>
                    <DataTableCell className="tabular-nums">{q.impressions}</DataTableCell>
                    <DataTableCell className="tabular-nums">{q.ctr}%</DataTableCell>
                    <DataTableCell className="tabular-nums">{q.position}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTable>
            </div>
          )}

          {gsc.topPages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Top landing pages (search)</h3>
              <DataTable headers={["Page", "Clicks", "Impressions"]}>
                {gsc.topPages.map((p) => (
                  <DataTableRow key={p.page}>
                    <DataTableCell className="max-w-md truncate text-xs">{p.page}</DataTableCell>
                    <DataTableCell className="tabular-nums">{p.clicks}</DataTableCell>
                    <DataTableCell className="tabular-nums">{p.impressions}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTable>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
