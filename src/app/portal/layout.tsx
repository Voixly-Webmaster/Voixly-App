import type { Metadata } from "next";
import { requireClient } from "@/lib/session-guard";
import { PortalShell } from "@/components/layout/portal-shell";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Voixly client portal — invoices, projects, files, and support.",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();
  const insights = user.clientId
    ? await prisma.clientGoogleIntegration.findFirst({
        where: {
          clientId: user.clientId,
          clientVisible: true,
        },
        select: { id: true, gaPropertyId: true, searchConsoleSite: true },
      })
    : null;
  const showInsights = Boolean(
    insights && (insights.gaPropertyId || insights.searchConsoleSite)
  );

  return (
    <PortalShell userName={user.name} showInsights={showInsights}>
      {children}
    </PortalShell>
  );
}
