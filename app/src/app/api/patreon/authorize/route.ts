import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { buildPatreonAuthorizeUrl, isPatreonConfigured } from "@/lib/patreon";
import { PATREON_STATE_COOKIE, patreonStateCookieOptions } from "@/lib/session";

export async function GET() {
  if (!isPatreonConfigured()) {
    return Response.json(
      { error: "Patreon login is not configured on this server yet" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(PATREON_STATE_COOKIE, state, patreonStateCookieOptions);

  return Response.redirect(buildPatreonAuthorizeUrl(state), 302);
}
