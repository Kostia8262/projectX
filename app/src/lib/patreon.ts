// Patreon OAuth identity + membership check — the second login/subscription
// path alongside the wallet+on-chain one. Requires an OAuth client
// registered in the creator's own Patreon developer dashboard; the whole
// flow is a no-op (button hidden, routes 500 with a clear message) until
// PATREON_CLIENT_ID/SECRET/REDIRECT_URI are set, same conditional pattern
// already used for the WalletConnect connector.
const PATREON_CLIENT_ID = process.env.PATREON_CLIENT_ID;
const PATREON_CLIENT_SECRET = process.env.PATREON_CLIENT_SECRET;
const PATREON_REDIRECT_URI = process.env.PATREON_REDIRECT_URI;
// A Patreon user can back many creators — this narrows the membership
// check down to just this campaign. Optional: if unset, ANY active pledge
// on the connected account counts (fine for early local testing only).
const PATREON_CAMPAIGN_ID = process.env.PATREON_CAMPAIGN_ID;

export function isPatreonConfigured(): boolean {
  return Boolean(PATREON_CLIENT_ID && PATREON_CLIENT_SECRET && PATREON_REDIRECT_URI);
}

export function buildPatreonAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: PATREON_CLIENT_ID ?? "",
    redirect_uri: PATREON_REDIRECT_URI ?? "",
    scope: "identity identity.memberships",
    state,
  });
  return `https://www.patreon.com/oauth2/authorize?${params.toString()}`;
}

type PatreonTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function requestToken(body: URLSearchParams): Promise<PatreonTokenResponse> {
  const res = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Patreon token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function exchangePatreonCode(code: string): Promise<PatreonTokenResponse> {
  return requestToken(
    new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: PATREON_CLIENT_ID ?? "",
      client_secret: PATREON_CLIENT_SECRET ?? "",
      redirect_uri: PATREON_REDIRECT_URI ?? "",
    })
  );
}

export function refreshPatreonToken(refreshToken: string): Promise<PatreonTokenResponse> {
  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: PATREON_CLIENT_ID ?? "",
      client_secret: PATREON_CLIENT_SECRET ?? "",
    })
  );
}

export type PatreonIdentity = {
  patreonUserId: string;
  displayName: string;
  membershipActive: boolean;
};

type PatreonIncludedItem = {
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: { campaign?: { data?: { id?: string } } };
};

// Throws on a 401 so callers can distinguish "token expired, please
// refresh" from a genuine network/API failure.
export async function fetchPatreonIdentity(accessToken: string): Promise<PatreonIdentity> {
  const url = new URL("https://www.patreon.com/api/oauth2/v2/identity");
  url.searchParams.set("include", "memberships.campaign");
  url.searchParams.set("fields[member]", "patron_status");
  url.searchParams.set("fields[user]", "full_name");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    throw new Error("PATREON_TOKEN_EXPIRED");
  }
  if (!res.ok) {
    throw new Error(`Patreon identity fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const patreonUserId: string = data.data.id;
  const displayName: string = data.data.attributes?.full_name ?? "Patreon";

  const memberships: PatreonIncludedItem[] = (data.included ?? []).filter(
    (item: PatreonIncludedItem) => item.type === "member"
  );
  const membershipActive = memberships.some((m) => {
    const campaignId = m.relationships?.campaign?.data?.id;
    const matchesCampaign = !PATREON_CAMPAIGN_ID || campaignId === PATREON_CAMPAIGN_ID;
    return matchesCampaign && m.attributes?.patron_status === "active_patron";
  });

  return { patreonUserId, displayName, membershipActive };
}
