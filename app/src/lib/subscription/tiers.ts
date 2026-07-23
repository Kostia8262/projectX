// Marketing/display layer for 4 subscription tiers, now backed by a real
// multi-tier contract (contracts/CoinTopUp... see SubscriptionPayments.sol)
// instead of the old single-price version. `contractTierId` is the uint8
// the contract's `tierPrices`/`subscribe()` use — it doubles as a rank for
// "tier X and above" checks (shop discount, exclusive accessories) since
// the ids are assigned in ascending order on purpose. Free is 0 and never
// actually calls the contract (see freePlan.ts), it just needs a rank to
// compare against.
export type SubscriptionTier = {
  id: string;
  name: string;
  priceLabel: string;
  tagline: string;
  benefits: string[];
  highlighted?: boolean;
  isFree?: boolean;
  contractTierId: number;
  /** Price in the payment token's smallest unit, as a string (safe to ship to the client). Undefined for the free tier. */
  priceTokenAmount?: string;
};

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Бесплатный",
    priceLabel: "0 USDT",
    tagline: "Начать без оплаты",
    benefits: [
      "Первые главы обоих персонажей",
      "Свободная игра без ограничений по времени",
      "Подарок за регистрацию: приветственный аксессуар для каждого персонажа",
    ],
    isFree: true,
    contractTierId: 0,
  },
  {
    id: "advanced",
    name: "Продвинутый",
    priceLabel: "6 USDT/мес",
    tagline: "Для тех, кто уже втянулся",
    benefits: [
      "Всё из «Базового»",
      "Приоритетный доступ к новым главам",
      "+50% к скорости восстановления энергии",
    ],
    highlighted: true,
    contractTierId: 1,
    priceTokenAmount: "6000000",
  },
  {
    id: "premium",
    name: "Премиум",
    priceLabel: "10 USDT/мес",
    tagline: "Полный доступ к механикам",
    benefits: ["Всё из «Продвинутого»", "Орудие «Плётка» сразу, без отдельной покупки", "Скидка 20% в магазине аксессуаров"],
    contractTierId: 2,
    priceTokenAmount: "10000000",
  },
  {
    id: "collector",
    name: "Коллекционный",
    priceLabel: "20 USDT/мес",
    tagline: "Для самых преданных",
    benefits: [
      "Всё из «Премиум»",
      "Эксклюзивные аксессуары, недоступные отдельно",
      "Ранний доступ к новым персонажам",
    ],
    contractTierId: 3,
    priceTokenAmount: "20000000",
  },
];

export function getTier(tierId: string): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS.find((t) => t.id === tierId);
}

/** Tier by its on-chain `contractTierId` (0 = free, never in the contract itself). */
export function getTierByContractId(contractTierId: number): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS.find((t) => t.contractTierId === contractTierId);
}
