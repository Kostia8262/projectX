import { getReward } from "@/lib/rewards/registry";
import { verifyRewardAccessToken } from "@/lib/rewards/accessToken";

// Stands in for fetching from S3/R2 with a pre-signed URL — here the
// "asset" is generated on the fly instead of stored, but the gate (verify
// a short-lived signed token before returning any bytes) is the real thing
// this phase needed to prove out.
function placeholderSvg(title: string, from: string, to: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}" />
        <stop offset="1" stop-color="${to}" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#0a0a0a" />
    <rect x="16" y="16" width="448" height="608" rx="24" fill="url(#g)" opacity="0.35" />
    <rect x="16" y="16" width="448" height="608" rx="24" fill="none" stroke="white" stroke-opacity="0.15" />
    <text x="240" y="320" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="white">${title}</text>
    <text x="240" y="356" text-anchor="middle" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.6)">placeholder — Фаза 8/9 заменит на реальный контент</text>
  </svg>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rewardId: string }> }
) {
  const { rewardId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 401 });
  }

  const verified = await verifyRewardAccessToken(token);
  if (!verified || verified.rewardId !== rewardId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const reward = getReward(rewardId);
  if (!reward) {
    return Response.json({ error: "Unknown reward" }, { status: 404 });
  }

  const svg = placeholderSvg(reward.title, reward.accentFrom, reward.accentTo);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, no-store",
    },
  });
}
