// Marketing/display layer for 4 subscription tiers. The underlying
// contract (contracts/SubscriptionPayments.sol) is still single-price and
// binary active/not-active — every tier's CTA currently drives the SAME
// on-chain payment. Real per-tier pricing needs a contract change (new
// price tiers + tier tracking on-chain or in the indexer), deliberately
// not done here without a separate decision, since it touches deployed
// payment infrastructure.
export type SubscriptionTier = {
  id: string;
  name: string;
  priceLabel: string;
  tagline: string;
  benefits: string[];
  highlighted?: boolean;
};

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "basic",
    name: "Базовый",
    priceLabel: "299 ₽/мес",
    tagline: "Начать знакомство",
    benefits: ["Доступ к первым главам обоих персонажей", "Орудие «Шлёпалка»", "Обычная скорость энергии"],
  },
  {
    id: "advanced",
    name: "Продвинутый",
    priceLabel: "599 ₽/мес",
    tagline: "Для тех, кто уже втянулся",
    benefits: [
      "Всё из «Базового»",
      "Приоритетный доступ к новым главам",
      "+50% к скорости восстановления энергии",
    ],
    highlighted: true,
  },
  {
    id: "premium",
    name: "Премиум",
    priceLabel: "999 ₽/мес",
    tagline: "Полный доступ к механикам",
    benefits: ["Всё из «Продвинутого»", "Орудие «Плётка» сразу, без отдельной покупки", "Скидка 20% в магазине аксессуаров"],
  },
  {
    id: "collector",
    name: "Коллекционный",
    priceLabel: "1990 ₽/мес",
    tagline: "Для самых преданных",
    benefits: [
      "Всё из «Премиум»",
      "Эксклюзивные аксессуары, недоступные отдельно",
      "Ранний доступ к новым персонажам",
    ],
  },
];
