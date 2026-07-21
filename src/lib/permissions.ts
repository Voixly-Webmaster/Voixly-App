import { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  clientId?: string | null;
  staffProfileId?: string | null;
};

export function isAdmin(user: SessionUser) {
  return user.role === UserRole.ADMIN;
}

export function isStaff(user: SessionUser) {
  return user.role === UserRole.STAFF || user.role === UserRole.ADMIN;
}

export function isClient(user: SessionUser) {
  return user.role === UserRole.CLIENT;
}

export function canAccessAdmin(user: SessionUser) {
  return isStaff(user);
}

export function canAccessClientPortal(user: SessionUser) {
  return user.role === UserRole.CLIENT && !!user.clientId;
}

export async function getAssignedClientIds(
  staffProfileId: string | null | undefined
): Promise<string[] | "all"> {
  if (!staffProfileId) return [];
  const { prisma } = await import("@/lib/db");
  const assignments = await prisma.staffClientAssignment.findMany({
    where: { staffId: staffProfileId },
    select: { clientId: true },
  });
  return assignments.map((a) => a.clientId);
}

/**
 * Returns true if `user` is allowed to access records for `clientId`.
 * - ADMIN: always allowed
 * - STAFF: allowed if assigned to that client
 * - CLIENT: allowed only for their own clientId
 */
export async function canAccessClient(
  user: SessionUser,
  clientId: string | null | undefined
): Promise<boolean> {
  if (!clientId) return user.role === UserRole.ADMIN;
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.CLIENT) return user.clientId === clientId;
  if (user.role === UserRole.STAFF) {
    const scope = await getAssignedClientIds(user.staffProfileId);
    if (scope === "all") return true;
    return scope.includes(clientId);
  }
  return false;
}

/** Throws "Unauthorized" if the user cannot access the given client. */
export async function assertClientAccess(
  user: SessionUser,
  clientId: string | null | undefined
): Promise<void> {
  const ok = await canAccessClient(user, clientId);
  if (!ok) throw new Error("Unauthorized");
}

export function clientScopeFilter(
  user: SessionUser,
  assignedClientIds: string[] | "all"
): { clientId?: string } | { clientId: { in: string[] } } | Record<string, never> {
  if (user.role === UserRole.CLIENT && user.clientId) {
    return { clientId: user.clientId };
  }
  if (user.role === UserRole.ADMIN) {
    return {};
  }
  if (user.role === UserRole.STAFF) {
    if (assignedClientIds === "all") return {};
    return { clientId: { in: assignedClientIds } };
  }
  return { clientId: "__none__" };
}
