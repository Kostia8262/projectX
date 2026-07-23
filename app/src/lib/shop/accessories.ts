// Cosmetic accessories — distinct from IMPLEMENTS (games/registry.ts), which
// are functional (change heat-per-hit). Accessories are decorative/flavor
// items per character; no real art pipeline yet, so each is a placeholder
// swatch + name, same "shape with a label" approach the implements started
// with before real assets existed.
export type AccessoryCategory = "outfit" | "decor" | "collectible";

export type Accessory = {
  id: string;
  name: string;
  description: string;
  category: AccessoryCategory;
  characterId: string; // which character this accessory applies to
  price: number; // in shop coins — see lib/shop/coinConfig.ts for the crypto conversion rate
  color: string;
  isRegistrationGift?: boolean; // granted for free by the free subscription tier, not sold here
  /** Collector tier's "exclusive accessories" benefit: requires the buyer's
   * active subscription contractTierId (see lib/subscription/tiers.ts) to
   * be >= this value. Unset = purchasable by anyone with enough coins.
   * No catalog item uses this yet (no exclusive content designed), but the
   * check is enforced in api/shop/buy the moment one does. */
  exclusiveToTier?: number;
};

export const ACCESSORIES: Accessory[] = [
  {
    id: "rin-outfit-casual",
    name: "Домашний наряд",
    description: "Простой, уютный образ для повседневных сцен.",
    category: "outfit",
    characterId: "rin",
    price: 1.5,
    color: "#f9a8d4",
  },
  {
    id: "rin-outfit-formal",
    name: "Строгий наряд",
    description: "Для случаев, когда она хочет выглядеть увереннее, чем чувствует себя.",
    category: "outfit",
    characterId: "rin",
    price: 3,
    color: "#a5b4fc",
  },
  {
    id: "rin-decor-room",
    name: "Уютная комната",
    description: "Меняет обстановку сцены на более домашнюю.",
    category: "decor",
    characterId: "rin",
    price: 2.5,
    color: "#fca5a5",
  },
  {
    id: "rin-outfit-sleepwear",
    name: "Ночная рубашка",
    description: "То, во что она переодевается, когда решает, что вечер только начинается.",
    category: "outfit",
    characterId: "rin",
    price: 2,
    color: "#e9d5ff",
  },
  {
    id: "rin-outfit-school",
    name: "Школьный образ",
    description: "Напоминание о том, какой она была совсем недавно.",
    category: "outfit",
    characterId: "rin",
    price: 2,
    color: "#bae6fd",
  },
  {
    id: "rin-decor-fairylights",
    name: "Гирлянда у кровати",
    description: "Тёплый свет для сцен, где ей нужно чувствовать себя в безопасности.",
    category: "decor",
    characterId: "rin",
    price: 1.5,
    color: "#fde68a",
  },
  {
    id: "rin-decor-diary",
    name: "Её дневник",
    description: "Она не показывает его никому — но оставила открытым специально для вас.",
    category: "decor",
    characterId: "rin",
    price: 2,
    color: "#ddd6fe",
  },
  {
    id: "rin-collectible-ribbon",
    name: "Лента из волос",
    description: "Коллекционный предмет без игрового эффекта — та самая, что она однажды сняла для вас.",
    category: "collectible",
    characterId: "rin",
    price: 4,
    color: "#fbcfe8",
  },
  {
    id: "rin-collectible-note",
    name: "Записка «спасибо, что подождал»",
    description: "Коллекционный предмет без игрового эффекта — она написала это сама, от руки.",
    category: "collectible",
    characterId: "rin",
    price: 4.5,
    color: "#fef3c7",
  },
  {
    id: "ada-outfit-leather",
    name: "Кожаный образ",
    description: "То, во что она одевается, когда настроена не отступать.",
    category: "outfit",
    characterId: "ada",
    price: 3,
    color: "#7c3aed",
  },
  {
    id: "ada-outfit-elegant",
    name: "Вечерний наряд",
    description: "Для сцен, где экзамен превращается в свидание.",
    category: "outfit",
    characterId: "ada",
    price: 3.5,
    color: "#f472b6",
  },
  {
    id: "ada-decor-studio",
    name: "Её студия",
    description: "Фон, отражающий, что здесь распоряжается она.",
    category: "decor",
    characterId: "ada",
    price: 2.5,
    color: "#fb923c",
  },
  {
    id: "ada-collectible-token",
    name: "Памятный жетон",
    description: "Коллекционный предмет без игрового эффекта — просто на память.",
    category: "collectible",
    characterId: "ada",
    price: 5,
    color: "#facc15",
  },
  {
    id: "ada-outfit-latex",
    name: "Латексный образ",
    description: "Она надевает это, когда хочет, чтобы вы сразу поняли, кто здесь главный.",
    category: "outfit",
    characterId: "ada",
    price: 3.5,
    color: "#1f2937",
  },
  {
    id: "ada-outfit-office",
    name: "Деловой костюм",
    description: "То, в чём она приходит, когда хочет напомнить, что экзамен ещё не окончен.",
    category: "outfit",
    characterId: "ada",
    price: 3,
    color: "#334155",
  },
  {
    id: "ada-decor-loft",
    name: "Её лофт",
    description: "Фон для сцен, где всё происходит на её условиях.",
    category: "decor",
    characterId: "ada",
    price: 2.5,
    color: "#78350f",
  },
  {
    id: "ada-decor-redlight",
    name: "Красный свет",
    description: "Она включает его, когда решает, что пора перестать церемониться.",
    category: "decor",
    characterId: "ada",
    price: 2,
    color: "#dc2626",
  },
  {
    id: "ada-collectible-note",
    name: "Записка «докажи»",
    description: "Коллекционный предмет без игрового эффекта — вызов, который она бросила вам в первый вечер.",
    category: "collectible",
    characterId: "ada",
    price: 4.5,
    color: "#fb7185",
  },
  {
    id: "rin-decor-welcome",
    name: "Открытка от Рин",
    description: "Оставила её специально для тех, кто только начинает — подарок за регистрацию.",
    category: "decor",
    characterId: "rin",
    price: 0,
    color: "#fbcfe8",
    isRegistrationGift: true,
  },
  {
    id: "ada-decor-welcome",
    name: "Визитка Ады",
    description: "«Позвони, когда решишься» — подарок за регистрацию.",
    category: "decor",
    characterId: "ada",
    price: 0,
    color: "#fdba74",
    isRegistrationGift: true,
  },
];

export function accessoriesFor(characterId: string): Accessory[] {
  return ACCESSORIES.filter((a) => a.characterId === characterId);
}

export function getAccessory(accessoryId: string): Accessory | undefined {
  return ACCESSORIES.find((a) => a.id === accessoryId);
}
