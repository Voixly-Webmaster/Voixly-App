"use client";

import { FormPanel } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/lib/ui";
import { saveInsightsConfig, disconnectGoogleInsights } from "@/actions/insights";
import { Settings2 } from "lucide-react";
import type { GaPropertyOption, GscSiteOption } from "@/lib/google/client";

export function InsightsPropertyForm({
  clientId,
  gaProperties,
  gscSites,
  current,
}: {
  clientId: string;
  gaProperties: GaPropertyOption[];
  gscSites: GscSiteOption[];
  current: {
    gaPropertyId: string | null;
    gaPropertyName: string | null;
    searchConsoleSite: string | null;
    clientVisible: boolean;
  };
}) {
  const save = saveInsightsConfig.bind(null, clientId);
  const disconnect = disconnectGoogleInsights.bind(null, clientId);

  return (
    <FormPanel
      title="Property settings"
      description="Choose which GA4 property and Search Console site to report on"
      icon={Settings2}
    >
      <form
        action={save}
        className="space-y-4"
        onSubmit={(e) => {
          const form = e.currentTarget;
          const select = form.elements.namedItem(
            "gaPropertyId"
          ) as HTMLSelectElement | null;
          const hidden = form.elements.namedItem(
            "gaPropertyName"
          ) as HTMLInputElement | null;
          if (select && hidden) {
            const opt = select.selectedOptions[0];
            hidden.value = opt?.dataset.name ?? current.gaPropertyName ?? "";
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gaPropertyId">GA4 property</Label>
            <select
              id="gaPropertyId"
              name="gaPropertyId"
              defaultValue={current.gaPropertyId ?? ""}
              className={selectClassName}
            >
              <option value="">Select property</option>
              {gaProperties.map((p) => (
                <option key={p.id} value={p.id} data-name={p.name}>
                  {p.name} ({p.account})
                </option>
              ))}
            </select>
            <input
              type="hidden"
              name="gaPropertyName"
              defaultValue={current.gaPropertyName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchConsoleSite">Search Console site</Label>
            <select
              id="searchConsoleSite"
              name="searchConsoleSite"
              defaultValue={current.searchConsoleSite ?? ""}
              className={selectClassName}
            >
              <option value="">Select site</option>
              {gscSites.map((s) => (
                <option key={s.siteUrl} value={s.siteUrl}>
                  {s.siteUrl} ({s.permissionLevel})
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="clientVisible"
            defaultChecked={current.clientVisible}
            className="rounded"
          />
          Show insights in client portal
        </label>

        <Button type="submit">Save settings</Button>
      </form>

      <form action={disconnect} className="mt-6 border-t border-border/60 pt-4">
        <Button type="submit" variant="outline" size="sm" className="text-destructive">
          Disconnect Google
        </Button>
      </form>
    </FormPanel>
  );
}
