import { verifyMessage } from "viem";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";
import { AGE_DISCLAIMER_MESSAGE } from "@/lib/constants";

export async function POST(request: Request) {
  const { signature } = await request.json();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return Response.json(
      { error: "No active session — sign in first" },
      { status: 401 }
    );
  }

  // Patreon sessions already proved identity via OAuth — there's no wallet
  // to sign with, so a plain confirmation is the right bar here, unlike the
  // wallet path below which re-proves address ownership via a signature.
  if (session.kind === "patreon") {
    const newToken = await createSessionToken({ ...session, ageConfirmed: true });
    cookieStore.set(SESSION_COOKIE, newToken, sessionCookieOptions);
    return Response.json({ success: true });
  }

  if (typeof signature !== "string") {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const isValid = await verifyMessage({
    address: session.address as `0x${string}`,
    message: AGE_DISCLAIMER_MESSAGE,
    signature: signature as `0x${string}`,
  });

  if (!isValid) {
    return Response.json({ error: "Signature does not match session address" }, { status: 401 });
  }

  const newToken = await createSessionToken({
    ...session,
    ageConfirmed: true,
  });
  cookieStore.set(SESSION_COOKIE, newToken, sessionCookieOptions);

  return Response.json({ success: true });
}
