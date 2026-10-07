import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { FormPanel } from "@/components/shared/form-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/actions/files";
import { fileDownloadUrl } from "@/lib/uploads";
import { formatDate, formatBytes } from "@/lib/utils";
import { Upload, Download } from "lucide-react";
import { PendingSubmit } from "@/components/shared/pending-submit";

export const metadata: Metadata = {
  title: "Files",
  description: "Download deliverables and documents shared with your team.",
};

export default async function PortalFilesPage() {
  const user = await requireClient();

  const files = await prisma.fileUpload.findMany({
    where: {
      clientId: user.clientId!,
      clientVisible: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Files" description="Upload and access shared documents" />

      <FormPanel
        title="Upload document"
        description="Files are visible to your Voixly team"
        icon={Upload}
      >
        <form action={uploadFile} className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="portal-file-input">File</Label>
            <Input id="portal-file-input" type="file" name="file" required className="max-w-sm" />
          </div>
          <PendingSubmit pendingLabel="Uploading…">Upload</PendingSubmit>
        </form>
      </FormPanel>

      <DataTable headers={["Name", "Size", "Uploaded by", "Date", ""]}>
        {files.map((f) => (
          <DataTableRow key={f.id}>
            <DataTableCell className="font-medium">{f.originalName}</DataTableCell>
            <DataTableCell className="tabular-nums">{formatBytes(f.sizeBytes)}</DataTableCell>
            <DataTableCell>{f.uploadedBy.name ?? "—"}</DataTableCell>
            <DataTableCell>{formatDate(f.createdAt)}</DataTableCell>
            <DataTableCell className="text-right">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={fileDownloadUrl(f.id)}
                  download={f.originalName}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Download ${f.originalName}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
