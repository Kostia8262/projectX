import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";
import { isAdminAddress } from "@/lib/admin";
import { isGrantedAdmin } from "@/lib/shop/store";

export type AdminSession = SessionPayload & { kind: "wallet" };

// Same shape as lib/shop/session.ts's requireWalletSession, plus the admin
// allowlist check. Admin is wallet-only — Patreon sessions can never be
// admin. Two allowlists, checked together: the hardcoded seed list in
// lib/admin.ts (bootstrap admins, can't be removed via UI — see
// store.ts's `grantedAdmins` comment) and the dynamic one managed from the
// Сотрудники page.
export async function requireAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.kind !== "wallet") return null;
  if (!isAdminAddress(session.address) && !(await isGrantedAdmin(session.address))) return null;
  return session as AdminSession;
}
