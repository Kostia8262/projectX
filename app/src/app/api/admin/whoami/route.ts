import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { requireAdminSession } from "@/lib/admin/session";

// Unlike every other /api/admin/* route (which 403s outright), this one
// always returns 200 with a status payload — it exists specifically so the
// admin pages can render a helpful "here's why you're denied" message
// instead of a wall of failed requests. See app/admin/layout.tsx.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return Response.json({ isAdmin: false, reason: "no-session" as const });
  }
  if (session.kind !== "wallet") {
    return Response.json({ isAdmin: false, reason: "not-wallet" as const, address: session.address });
  }

  const adminSession = await requireAdminSession();
  if (!adminSession) {
    return Response.json({ isAdmin: false, reason: "not-admin" as const, address: session.address });
  }

  return Response.json({ isAdmin: true, address: adminSession.address, role: adminSession.role });
}
