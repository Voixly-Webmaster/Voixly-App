import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { FormPanel } from "@/components/shared/form-panel";
import { SearchInput } from "@/components/shared/search-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/actions/files";
import { fileDownloadUrl } from "@/lib/uploads";
import { formatDate, formatBytes } from "@/lib/utils";
import { selectClassName } from "@/lib/ui";
import { Upload, Download } from "lucide-react";
import { DeleteFileButton } from "@/components/files/delete-file-button";

export const metadata: Metadata = {
  title: "Files",
  description: "Upload and share files with clients.",
};

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdmin();
  const scope = await getStaffClientScope(user);
  const { q } = await searchParams;

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(scope !== "all" ? { id: { in: scope.length ? scope : ["__none__"] } } : {}),
    },
    orderBy: { companyName: "asc" },
  });

  const files = await prisma.fileUpload.findMany({
    where: {
      deletedAt: null,
      ...(scope !== "all" ? { clientId: { in: scope } } : {}),
      ...(q
        ? {
            OR: [
              { originalName: { contains: q } },
              { client: { companyName: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      client: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Client and internal document uploads"
        action={<SearchInput placeholder="Search files..." />}
      />

      <FormPanel
        title="Upload file"
        description="Files are served through an authenticated route, not the public folder"
        icon={Upload}
      >
        <form action={uploadFile} className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="file-client">Client</Label>
            <select
              id="file-client"
              name="clientId"
              className={selectClassName + " min-w-[200px]"}
            >
              <option value="">Internal</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-input">File</Label>
            <Input id="file-input" type="file" name="file" required className="max-w-xs" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="clientVisible"
              defaultChecked
              className="rounded"
            />
            Client visible
          </label>
          <Button type="submit">Upload</Button>
        </form>
      </FormPanel>

      <DataTable headers={["File", "Client", "Size", "Uploaded by", "Date", ""]}>
        {files.map((f) => (
          <DataTableRow key={f.id}>
            <DataTableCell className="font-medium">
              <span className="truncate">{f.originalName}</span>
              {!f.clientVisible && (
                <span className="ml-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  Internal
                </span>
              )}
            </DataTableCell>
            <DataTableCell>{f.client?.companyName ?? "Internal"}</DataTableCell>
            <DataTableCell className="tabular-nums">{formatBytes(f.sizeBytes)}</DataTableCell>
            <DataTableCell>{f.uploadedBy.name ?? "—"}</DataTableCell>
            <DataTableCell>{formatDate(f.createdAt)}</DataTableCell>
            <DataTableCell className="text-right">
              <div className="flex justify-end gap-1">
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
                <DeleteFileButton fileId={f.id} fileName={f.originalName} />
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
