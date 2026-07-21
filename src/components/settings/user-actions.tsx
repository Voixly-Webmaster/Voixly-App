"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  updateUserRole,
  resetUserPassword,
  setUserActive,
} from "@/actions/users";
import { KeyRound, Loader2, ShieldCheck, UserX, UserCheck } from "lucide-react";

export function UserActions({
  userId,
  userName,
  email,
  role,
  active,
  isSelf,
}: {
  userId: string;
  userName: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CLIENT";
  active: boolean;
  isSelf: boolean;
}) {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [roleOpen, setRoleOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState(role);

  const run = (fn: () => Promise<void>, successMsg: string) => {
    startTransition(async () => {
      try {
        await fn();
        success(successMsg);
        setResetOpen(false);
        setRoleOpen(false);
      } catch (err) {
        error("Action failed", err instanceof Error ? err.message : undefined);
      }
    });
  };

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">This is you</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {role !== "CLIENT" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNewRole(role);
            setRoleOpen(true);
          }}
          disabled={pending || !active}
          title="Change role"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Role
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setResetOpen(true)}
        disabled={pending || !active}
        title="Reset password"
      >
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        Password
      </Button>

      {active ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Deactivate ${userName}?`,
              description: `${email} will no longer be able to sign in. Their data is kept and the account can be reactivated at any time.`,
              confirmLabel: "Deactivate",
              tone: "destructive",
            });
            if (ok) run(() => setUserActive(userId, false), "User deactivated");
          }}
        >
          <UserX className="h-3.5 w-3.5" aria-hidden />
          Deactivate
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setUserActive(userId, true), "User reactivated")}
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden />
          Reactivate
        </Button>
      )}

      {/* Change role dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change role — {userName}</DialogTitle>
            <DialogDescription>
              Admins have full access including settings. Staff only see their
              assigned clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`role-${userId}`}>Role</Label>
            <select
              id={`role-${userId}`}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as typeof role)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || newRole === role}
              onClick={() => {
                const formData = new FormData();
                formData.set("role", newRole);
                run(() => updateUserRole(userId, formData), "Role updated");
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password — {userName}</DialogTitle>
            <DialogDescription>
              Set a new temporary password and share it with {email} securely.
            </DialogDescription>
          </DialogHeader>
          <form
            id={`reset-form-${userId}`}
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              run(
                () => resetUserPassword(userId, formData),
                "Password reset"
              );
            }}
          >
            <Label htmlFor={`pw-${userId}`}>New password</Label>
            <Input
              id={`pw-${userId}`}
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="font-mono"
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={`reset-form-${userId}`} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
