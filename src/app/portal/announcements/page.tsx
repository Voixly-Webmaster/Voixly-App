import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils";
import { Megaphone } from "lucide-react";

export default async function PortalAnnouncementsPage() {
  await requireClient();

  const announcements = await prisma.announcement.findMany({
    where: { published: true, deletedAt: null },
    orderBy: { publishAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Company news and notices" />
      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="Check back later for updates from your team."
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Panel key={a.id} title={a.title} description={formatDate(a.publishAt)} accent="none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
