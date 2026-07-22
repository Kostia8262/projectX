import { cookies } from "next/headers";
import { exchangePatreonCode, fetchPatreonIdentity } from "@/lib/patreon";
import {
  createSessionToken,
  PATREON_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(PATREON_STATE_COOKIE)?.value;
  cookieStore.delete(PATREON_STATE_COOKIE);

  if (!code || !state || !storedState || state !== storedState) {
    return Response.json({ error: "Invalid or expired Patreon OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangePatreonCode(code);
    const identity = await fetchPatreonIdentity(tokens.access_token);

    const token = await createSessionToken({
      address: `patreon:${identity.patreonUserId}`,
      kind: "patreon",
      ageConfirmed: false,
      displayName: identity.displayName,
      patreonAccessToken: tokens.access_token,
      patreonRefreshToken: tokens.refresh_token,
      patreonTokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    });
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

    return Response.redirect(new URL("/", request.url), 302);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Patreon sign-in failed" },
      { status: 400 }
    );
  }
}
