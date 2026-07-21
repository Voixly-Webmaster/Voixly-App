import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessAdmin,
  canAccessClientPortal,
  type SessionUser,
} from "@/lib/permissions";
import { getAssignedClientIds } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canAccessAdmin(user)) redirect("/portal");
  return user;
}

/** Requires the ADMIN role specifically (staff are not allowed). */
export async function requireAdminRole(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== UserRole.ADMIN) redirect("/admin");
  return user;
}

export async function requireClient(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canAccessClientPortal(user)) redirect("/admin");
  return user;
}

export async function getStaffClientScope(user: SessionUser) {
  if (user.role === UserRole.ADMIN) return "all" as const;
  if (user.role === UserRole.STAFF) {
    return getAssignedClientIds(user.staffProfileId);
  }
  return [] as string[];
}
