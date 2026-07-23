import { requireWalletSession } from "@/lib/shop/session";
import { syncCoinTopUps } from "@/lib/shop/coinIndexer";
import { getBalance, getOwnedAccessories } from "@/lib/shop/store";
import { getEffectiveWalletSubscriptionStatus } from "@/lib/subscription/effectiveStatus";
import { shopDiscountPercentFor } from "@/lib/shop/pricing";

export async function GET() {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json(
      { error: "Магазин пока доступен только для кошелька" },
      { status: 403 }
    );
  }

  await syncCoinTopUps();
  const [balance, owned, subscription] = await Promise.all([
    getBalance(session.address),
    getOwnedAccessories(session.address),
    getEffectiveWalletSubscriptionStatus(session.address),
  ]);

  return Response.json({
    balance,
    owned,
    discountPercent: shopDiscountPercentFor(subscription.tierId),
    activeTierId: subscription.tierId,
  });
}
