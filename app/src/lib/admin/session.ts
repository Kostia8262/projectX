import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";
import { isAdminAddress } from "@/lib/admin";
import { getGrantedAdminRole } from "@/lib/shop/store";
import type { EmployeeRole } from "@/lib/admin/roles";

export type AdminSession = SessionPayload & { kind: "wallet"; role: EmployeeRole };

// Same shape as lib/shop/session.ts's requireWalletSession, plus the admin
// allowlist check. Admin is wallet-only — Patreon sessions can never be
// admin. Two allowlists, checked together: the hardcoded seed list in
// lib/admin.ts (bootstrap admins, can't be removed via UI — see
// store.ts's `grantedAdmins` comment, always "owner") and the dynamic one
// managed from the Сотрудники page (role stored per employee).
export async function requireAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.kind !== "wallet") return null;
  if (isAdminAddress(session.address)) {
    return { ...session, role: "owner" } as AdminSession;
  }
  const role = await getGrantedAdminRole(session.address);
  if (!role) return null;
  return { ...session, role } as AdminSession;
}

// Same as requireAdminSession, plus a capability check — use this instead
// of requireAdminSession directly in any route that mutates something a
// "support" or "viewer" employee shouldn't be able to touch (see
// lib/admin/roles.ts for what each role can do).
export async function requireAdminRole(
  allowed: (role: EmployeeRole) => boolean
): Promise<AdminSession | null> {
  const session = await requireAdminSession();
  if (!session || !allowed(session.role)) return null;
  return session;
}
