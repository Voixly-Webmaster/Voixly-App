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
import { actionErrorMessage } from "@/lib/action-error";
import {
  updateUserRole,
  resetUserPassword,
  setUserActive,
  deleteUser,
} from "@/actions/users";
import { resendTeamInvite } from "@/actions/invites";
import { clearUserTwoFactor } from "@/actions/account-access";
import {
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";

export function UserActions({
  userId,
  userName,
  email,
  companyName,
  role,
  active,
  pendingSetup,
  isSelf,
  twoFactor,
}: {
  userId: string;
  userName: string;
  email: string;
  companyName: string | null;
  role: "ADMIN" | "STAFF" | "CLIENT";
  active: boolean;
  pendingSetup: boolean;
  isSelf: boolean;
  twoFactor: boolean;
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
        error("Action failed", actionErrorMessage(err));
      }
    });
  };

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">This is you</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {pendingSetup && role !== "CLIENT" && active && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          title="Resend setup invite"
          onClick={() => {
            startTransition(async () => {
              try {
                const result = await resendTeamInvite(userId);
                if ("error" in result) {
                  error("Could not resend invite", result.error);
                  return;
                }
                success(
                  result.emailSent ? "Invite sent" : "Invite not emailed",
                  result.emailSent
                    ? "A new setup link is on its way. The previous link no longer works."
                    : "The account is still waiting, but the email did not send."
                );
              } catch (err) {
                error("Could not resend invite", actionErrorMessage(err));
              }
            });
          }}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Resend invite
        </Button>
      )}
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

      {twoFactor && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !active}
          title="Turn off sign-in codes"
          onClick={async () => {
            const ok = await confirm({
              title: `Turn off sign-in codes for ${userName}?`,
              description: `${email} will be able to sign in with just a password until they turn codes back on.`,
              confirmLabel: "Turn off",
              tone: "destructive",
            });
            if (ok) run(() => clearUserTwoFactor(userId), "Sign-in codes turned off");
          }}
        >
          <ShieldOff className="h-3.5 w-3.5" aria-hidden />
          2FA
        </Button>
      )}

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

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="text-destructive hover:text-destructive"
        onClick={async () => {
          const company = companyName || "their company";
          const ok = await confirm({
            title: `Delete ${userName}?`,
            description:
              role === "CLIENT"
                ? `This permanently removes ${email} and ${company}, including invoices, tickets, and files. Any Stripe subscription for that company is cancelled.`
                : `This permanently removes ${email}. That email can be used again. Tasks, ticket replies, notes, and files they created stay, attributed to you.`,
            confirmLabel: "Delete user",
            tone: "destructive",
          });
          if (!ok) return;
          startTransition(async () => {
            try {
              const result = await deleteUser(userId);
              if ("error" in result) {
                error("Could not delete user", result.error);
                return;
              }
              success("User deleted");
            } catch (err) {
              error("Could not delete user", actionErrorMessage(err));
            }
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete
      </Button>

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
