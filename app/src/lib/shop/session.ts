import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

// The shop is crypto-only for now (Patreon accounts have no on-chain wallet
// to pay from, and Patreon's API doesn't support one-off charges — see the
// shop-mechanic design discussion). This is the single gate every shop route
// shares so that restriction lives in one place.
export type WalletSession = SessionPayload & { kind: "wallet" };

export async function requireWalletSession(): Promise<WalletSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.kind !== "wallet") return null;
  return session as WalletSession;
}
