import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/utils";
import { activityLabel } from "@/lib/activity-labels";

export default async function AdminActivityPage() {
  const user = await requireAdmin();
  const scope = await getStaffClientScope(user);
  const clientScope =
    scope === "all"
      ? {}
      : { clientId: { in: scope.length ? scope : ["__none__"] } };

  const logs = await prisma.activityLog.findMany({
    where: clientScope,
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
            <DataTableCell>
              <p className="font-medium">{activityLabel(log.action)}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{log.action}</p>
            </DataTableCell>
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
