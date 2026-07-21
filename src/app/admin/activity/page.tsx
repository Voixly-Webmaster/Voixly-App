import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/utils";

export default async function AdminActivityPage() {
  await requireAdmin();

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { name: true, email: true } },
      client: { select: { companyName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" description="Audit trail of key actions" />
      <DataTable headers={["Action", "Actor", "Client", "When"]}>
        {logs.map((log) => (
          <DataTableRow key={log.id}>
            <DataTableCell className="font-mono text-xs">{log.action}</DataTableCell>
            <DataTableCell>
              {log.actor?.name ?? log.actor?.email ?? "System"}
            </DataTableCell>
            <DataTableCell>{log.client?.companyName ?? "—"}</DataTableCell>
            <DataTableCell>{formatDateTime(log.createdAt)}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
