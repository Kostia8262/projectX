import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";

const PREMIUM_TIER_ID = SUBSCRIPTION_TIERS.find((t) => t.id === "premium")!.contractTierId;

// Premium's "Скидка 20% в магазине аксессуаров" benefit, inherited by
// Collector ("Всё из «Премиум»") since contractTierId is assigned in
// ascending order — anyone at or above Premium's rank qualifies.
const SHOP_DISCOUNT_PERCENT = 20;

export function shopDiscountPercentFor(activeTierId: number | null): number {
  if (activeTierId === null) return 0;
  return activeTierId >= PREMIUM_TIER_ID ? SHOP_DISCOUNT_PERCENT : 0;
}

export function applyShopDiscount(price: number, activeTierId: number | null): number {
  const percent = shopDiscountPercentFor(activeTierId);
  if (percent === 0) return price;
  return Math.ceil(price * (1 - percent / 100));
}

export function meetsExclusiveTier(
  exclusiveToTier: number | undefined,
  activeTierId: number | null
): boolean {
  if (exclusiveToTier === undefined) return true;
  return activeTierId !== null && activeTierId >= exclusiveToTier;
}
