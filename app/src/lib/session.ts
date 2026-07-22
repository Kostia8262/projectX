import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "kink_session";
export const NONCE_COOKIE = "siwe_nonce";
export const PATREON_STATE_COOKIE = "patreon_oauth_state";

const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret && process.env.NODE_ENV !== "production") {
  console.warn(
    "[session] SESSION_SECRET is not set — using an insecure dev-only fallback. " +
      "Set SESSION_SECRET in .env.local before deploying anywhere real."
  );
}
const secretKey = new TextEncoder().encode(
  rawSecret ?? "dev-only-insecure-secret-do-not-use-in-production"
);

// `address` is really "the subject identifier" — for wallet logins it's the
// 0x address; for Patreon logins it's a synthetic `patreon:<patreonUserId>`
// string. Every downstream consumer (energy, per-game progress, rewards)
// already treats it as an opaque per-user key, so widening what it can hold
// avoids a rename across a dozen files for no functional gain there.
export type SessionPayload = {
  address: string;
  kind: "wallet" | "patreon";
  ageConfirmed: boolean;
  displayName?: string; // Patreon full name — wallet sessions derive their own label from the address
  patreonAccessToken?: string;
  patreonRefreshToken?: string;
  patreonTokenExpiresAt?: number; // unix seconds
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.address !== "string") return null;
    return {
      address: payload.address,
      kind: payload.kind === "patreon" ? "patreon" : "wallet",
      ageConfirmed: Boolean(payload.ageConfirmed),
      displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
      patreonAccessToken:
        typeof payload.patreonAccessToken === "string" ? payload.patreonAccessToken : undefined,
      patreonRefreshToken:
        typeof payload.patreonRefreshToken === "string" ? payload.patreonRefreshToken : undefined,
      patreonTokenExpiresAt:
        typeof payload.patreonTokenExpiresAt === "number" ? payload.patreonTokenExpiresAt : undefined,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export const nonceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 5, // 5 minutes to complete the SIWE round trip
};

export const patreonStateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 10, // 10 minutes to complete the OAuth round trip
};
