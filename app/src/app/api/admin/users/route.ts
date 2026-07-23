import { requireAdminSession } from "@/lib/admin/session";
import { listKnownAddresses, listSubscriptionOverrides } from "@/lib/shop/store";
import { listAllChainSubscriptions } from "@/lib/subscriptionIndexer";

export type AdminUserRow = {
  address: string;
  balance: number;
  ownedIds: string[];
  freePlanActivated: boolean;
  subscription: { tierId: number; active: boolean; activeUntil: number | null } | null;
  subscriptionSource: "chain" | "admin-override" | "free-plan" | null;
};

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const [shopUsers, chainSubs, overrides] = await Promise.all([
    listKnownAddresses(),
    listAllChainSubscriptions(),
    listSubscriptionOverrides(),
  ]);

  const chainByAddress = new Map(chainSubs.map((s) => [s.address, s]));
  const addresses = new Set([
    ...shopUsers.map((u) => u.address),
    ...chainSubs.map((s) => s.address),
    ...Object.keys(overrides),
  ]);

  const rows: AdminUserRow[] = [...addresses].map((address) => {
    const shopUser = shopUsers.find((u) => u.address === address);
    const chainSub = chainByAddress.get(address);
    const override = overrides[address];
    const nowSeconds = Math.floor(Date.now() / 1000);
    const overrideActive = override ? nowSeconds < override.activeUntil : false;

    // A real, currently-active chain subscription always wins over the
    // admin override for display, same precedence as effectiveStatus.ts.
    // Free tier is neither of those — it's a separate `freePlanActivated`
    // flag with no chain/override presence at all (contractTierId 0 never
    // touches the subscription contract) — so it only shows up here as a
    // last-resort fallback when there's no paid tier to display instead.
    let subscription: AdminUserRow["subscription"] = null;
    let subscriptionSource: AdminUserRow["subscriptionSource"] = null;
    if (chainSub?.active) {
      subscription = { tierId: chainSub.tierId, active: true, activeUntil: chainSub.activeUntil };
      subscriptionSource = "chain";
    } else if (overrideActive) {
      subscription = { tierId: override.tierId, active: true, activeUntil: override.activeUntil };
      subscriptionSource = "admin-override";
    } else if (chainSub) {
      subscription = { tierId: chainSub.tierId, active: false, activeUntil: chainSub.activeUntil };
      subscriptionSource = "chain";
    } else if (shopUser?.freePlanActivated) {
      subscription = { tierId: 0, active: true, activeUntil: null };
      subscriptionSource = "free-plan";
    }

    return {
      address,
      balance: shopUser?.balance ?? 0,
      ownedIds: shopUser?.ownedIds ?? [],
      freePlanActivated: shopUser?.freePlanActivated ?? false,
      subscription,
      subscriptionSource,
    };
  });

  rows.sort((a, b) => a.address.localeCompare(b.address));
  return Response.json({ users: rows });
}
