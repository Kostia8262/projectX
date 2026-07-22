import { isAddress } from "viem";
import { cookies } from "next/headers";
import { getSubscriptionStatus } from "@/lib/subscriptionIndexer";
import { getPatreonSubscriptionStatus } from "@/lib/patreonSubscription";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Patreon membership is per-account via their OAuth token, not derivable
  // from a client-supplied ?address= — always resolve it from the caller's
  // own session rather than the query string.
  if (session?.kind === "patreon") {
    const status = await getPatreonSubscriptionStatus(session);
    return Response.json(status);
  }

  const { searchParams } = new URL(request.url);
  const address = session?.address ?? searchParams.get("address");

  if (!address || !isAddress(address)) {
    return Response.json({ error: "Missing or invalid ?address=" }, { status: 400 });
  }

  const status = await getSubscriptionStatus(address);
  return Response.json(status);
}
