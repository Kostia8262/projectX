import { cookies } from "next/headers";
import { fetchPatreonIdentity, refreshPatreonToken } from "@/lib/patreon";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  type SessionPayload,
} from "@/lib/session";
import type { SubscriptionStatus } from "@/lib/subscriptionIndexer";

// Checks membership for a Patreon-kind session, transparently refreshing
// the access token (and rewriting the session cookie) once if Patreon
// reports it expired — same shape as the wallet path's SubscriptionStatus
// so both route handlers can treat the two identity kinds uniformly.
export async function getPatreonSubscriptionStatus(
  session: SessionPayload
): Promise<SubscriptionStatus> {
  if (!session.patreonAccessToken) {
    return { active: false, lastPaidAt: null, activeUntil: null };
  }

  try {
    const identity = await fetchPatreonIdentity(session.patreonAccessToken);
    return {
      active: identity.membershipActive,
      lastPaidAt: null,
      activeUntil: null,
    };
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "PATREON_TOKEN_EXPIRED" || !session.patreonRefreshToken) {
      throw err;
    }

    const refreshed = await refreshPatreonToken(session.patreonRefreshToken);
    const identity = await fetchPatreonIdentity(refreshed.access_token);

    const newSession: SessionPayload = {
      ...session,
      patreonAccessToken: refreshed.access_token,
      patreonRefreshToken: refreshed.refresh_token,
      patreonTokenExpiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    };
    const newToken = await createSessionToken(newSession);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, newToken, sessionCookieOptions);

    return { active: identity.membershipActive, lastPaidAt: null, activeUntil: null };
  }
}
