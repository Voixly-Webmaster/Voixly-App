import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { FormPanel } from "@/components/shared/form-panel";
import {
  DataTable,
  DataTableRow,
  DataTableCell,
} from "@/components/shared/data-table";
import { CreateUserForm } from "@/components/settings/create-user-form";
import { UserActions } from "@/components/settings/user-actions";
import { formatDate } from "@/lib/utils";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const roleBadge: Record<string, string> = {
  ADMIN: "bg-primary/10 text-primary",
  STAFF: "bg-secondary/15 text-secondary-foreground",
  CLIENT: "bg-muted text-muted-foreground",
};

export default async function UsersSettingsPage() {
  const admin = await requireAdminRole();

  const users = await prisma.user.findMany({
    orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
    include: { clientProfile: { select: { companyName: true } } },
  });

  return (
    <div className="space-y-6">
      <FormPanel
        title="Add user"
        description="Create admin, staff, or client accounts"
        icon={UserPlus}
      >
        <CreateUserForm />
      </FormPanel>

      <DataTable
        headers={["User", "Role", "Company", "Status", "Created", ""]}
        emptyMessage="No users yet."
      >
        {users.map((u) => {
          const active = !u.deletedAt;
          return (
            <DataTableRow key={u.id} className={active ? "" : "opacity-60"}>
              <DataTableCell>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{u.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </DataTableCell>
              <DataTableCell>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    roleBadge[u.role]
                  )}
                >
                  {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                </span>
              </DataTableCell>
              <DataTableCell className="text-muted-foreground">
                {u.clientProfile?.companyName ?? "—"}
              </DataTableCell>
              <DataTableCell>
                {active ? (
                  <span className="rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-medium text-success-foreground">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    Deactivated
                  </span>
                )}
              </DataTableCell>
              <DataTableCell className="text-muted-foreground">
                {formatDate(u.createdAt)}
              </DataTableCell>
              <DataTableCell className="text-right">
                <UserActions
                  userId={u.id}
                  userName={u.name ?? u.email}
                  email={u.email}
                  role={u.role}
                  active={active}
                  isSelf={u.id === admin.id}
                />
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTable>
    </div>
  );
}
