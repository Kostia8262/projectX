import { generateNonce } from "siwe";
import { cookies } from "next/headers";
import { NONCE_COOKIE, nonceCookieOptions } from "@/lib/session";

export async function GET() {
  const nonce = generateNonce();
  const cookieStore = await cookies();
  cookieStore.set(NONCE_COOKIE, nonce, nonceCookieOptions);
  return Response.json({ nonce });
}
