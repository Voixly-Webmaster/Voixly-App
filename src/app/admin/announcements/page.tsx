import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { FormPanel } from "@/components/shared/form-panel";
import { Panel } from "@/components/shared/panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createAnnouncement } from "@/actions/announcements";
import { formatDate } from "@/lib/utils";
import { Megaphone } from "lucide-react";

export default async function AdminAnnouncementsPage() {
  await requireAdmin();

  const announcements = await prisma.announcement.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Publish notices to all clients" />

      <FormPanel
        title="New announcement"
        description="Visible to all clients when published"
        icon={Megaphone}
      >
        <form action={createAnnouncement} className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input name="title" required />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea name="body" required rows={4} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="publish" defaultChecked className="rounded" />
            Publish immediately
          </label>
          <Button type="submit">Publish</Button>
        </form>
      </FormPanel>

      <div className="space-y-4">
        {announcements.map((a) => (
          <Panel
            key={a.id}
            title={a.title}
            description={formatDate(a.publishAt ?? a.createdAt)}
            action={
              a.published ? (
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
    </div>
  );
}
