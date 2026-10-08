import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { FormPanel } from "@/components/shared/form-panel";
import { Panel } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/empty-state";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementActions } from "@/components/announcements/announcement-actions";
import { formatDate } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { Megaphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Announcements",
  description: "Publish updates by portal, email, and text.",
};

export default async function AdminAnnouncementsPage() {
  const user = await requireAdmin();

  const announcements = await prisma.announcement.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Publish notices to every client in the portal, by email, and by text"
      />

      {user.role === UserRole.ADMIN && (
        <FormPanel
          title="New announcement"
          description="Published notices go to the portal, each client's email, and any mobile number on file"
          icon={Megaphone}
        >
          <AnnouncementForm />
        </FormPanel>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Published notices will appear here and in the client portal."
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Panel
              key={a.id}
              title={a.title}
              description={formatDate(a.publishAt ?? a.createdAt)}
              action={
                user.role === UserRole.ADMIN ? (
                  <AnnouncementActions
                    id={a.id}
                    title={a.title}
                    published={a.published}
                  />
                ) : a.published ? (
                  <span className="rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success-foreground">
                    Published
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Draft
                  </span>
                )
              }
              accent="none"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
