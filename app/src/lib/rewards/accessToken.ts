import { SignJWT, jwtVerify } from "jose";

const rawSecret = process.env.REWARD_TOKEN_SECRET;
if (!rawSecret && process.env.NODE_ENV !== "production") {
  console.warn(
    "[rewards] REWARD_TOKEN_SECRET is not set — using an insecure dev-only fallback. " +
      "Set REWARD_TOKEN_SECRET in .env.local before deploying anywhere real."
  );
}
const secretKey = new TextEncoder().encode(
  rawSecret ?? "dev-only-insecure-reward-secret-do-not-use-in-production"
);

const TOKEN_TTL_SECONDS = 60; // short-lived — this stands in for an S3 pre-signed URL

export async function createRewardAccessToken(rewardId: string, address: string) {
  return new SignJWT({ rewardId, address: address.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifyRewardAccessToken(
  token: string
): Promise<{ rewardId: string; address: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.rewardId !== "string" || typeof payload.address !== "string") return null;
    return { rewardId: payload.rewardId, address: payload.address };
  } catch {
    return null;
  }
}
