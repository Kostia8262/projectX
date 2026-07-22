import { SiweMessage } from "siwe";
import { cookies } from "next/headers";
import {
  createSessionToken,
  NONCE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
  const { message, signature } = await request.json();

  if (typeof message !== "string" || typeof signature !== "string") {
    return Response.json({ error: "Missing message or signature" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get(NONCE_COOKIE)?.value;

  if (!storedNonce) {
    return Response.json(
      { error: "Missing or expired nonce — request a new one from /api/siwe/nonce" },
      { status: 400 }
    );
  }

  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature, nonce: storedNonce });

    if (!result.success) {
      return Response.json(
        { error: result.error?.type ?? "SIWE verification failed" },
        { status: 401 }
      );
    }

    cookieStore.delete(NONCE_COOKIE);

    const token = await createSessionToken({
      address: result.data.address,
      kind: "wallet",
      ageConfirmed: false,
    });
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);

    return Response.json({ success: true, address: result.data.address });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid SIWE message" },
      { status: 400 }
    );
  }
}
