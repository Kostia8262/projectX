import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getSubscriptionStatus } from "@/lib/subscriptionIndexer";
import { getPatreonSubscriptionStatus } from "@/lib/patreonSubscription";
import { getReward } from "@/lib/rewards/registry";
import { createRewardAccessToken } from "@/lib/rewards/accessToken";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rewardId: string }> }
) {
  const { rewardId } = await params;
  const reward = getReward(rewardId);
  if (!reward) {
    return Response.json({ error: "Unknown reward" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return Response.json({ error: "Sign in first" }, { status: 401 });
  }
  if (!session.ageConfirmed) {
    return Response.json({ error: "Age not confirmed" }, { status: 403 });
  }

  const subscription =
    session.kind === "patreon"
      ? await getPatreonSubscriptionStatus(session)
      : await getSubscriptionStatus(session.address);
  if (!subscription.active) {
    return Response.json(
      { error: "No active subscription — this scene is subscriber-only" },
      { status: 403 }
    );
  }

  const accessToken = await createRewardAccessToken(rewardId, session.address);
  return Response.json({
    url: `/api/rewards/asset/${rewardId}?token=${encodeURIComponent(accessToken)}`,
  });
}
