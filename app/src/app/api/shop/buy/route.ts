import { requireWalletSession } from "@/lib/shop/session";
import { getAccessory } from "@/lib/shop/accessories";
import { getEffectiveWalletSubscriptionStatus } from "@/lib/subscription/effectiveStatus";
import { applyShopDiscount, meetsExclusiveTier, shopDiscountPercentFor } from "@/lib/shop/pricing";
import { purchaseAccessory, getBalance, getOwnedAccessories } from "@/lib/shop/store";

export async function POST(request: Request) {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json(
      { error: "Магазин пока доступен только для кошелька" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const accessoryId = typeof body?.accessoryId === "string" ? body.accessoryId : null;
  if (!accessoryId) {
    return Response.json({ error: "Missing accessoryId" }, { status: 400 });
  }

  const accessory = getAccessory(accessoryId);
  if (!accessory || accessory.isRegistrationGift) {
    return Response.json({ error: "Unknown accessory" }, { status: 404 });
  }

  const subscription = await getEffectiveWalletSubscriptionStatus(session.address);

  if (!meetsExclusiveTier(accessory.exclusiveToTier, subscription.tierId)) {
    return Response.json(
      { error: "Этот аксессуар — эксклюзив более высокого тира подписки" },
      { status: 403 }
    );
  }

  const price = applyShopDiscount(accessory.price, subscription.tierId);
  const result = await purchaseAccessory(session.address, accessoryId, price);
  if (!result.ok) {
    const status = result.reason === "already-owned" ? 409 : 402;
    const message =
      result.reason === "already-owned" ? "Уже куплено" : "Недостаточно монет — пополните баланс";
    return Response.json({ error: message }, { status });
  }

  const [balance, owned] = await Promise.all([
    getBalance(session.address),
    getOwnedAccessories(session.address),
  ]);
  return Response.json({
    balance,
    owned,
    discountPercent: shopDiscountPercentFor(subscription.tierId),
    activeTierId: subscription.tierId,
  });
}
