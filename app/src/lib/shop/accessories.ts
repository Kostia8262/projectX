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
  price: number; // display-only for now, no real payment wired yet
  color: string;
};

export const ACCESSORIES: Accessory[] = [
  {
    id: "rin-outfit-casual",
    name: "Домашний наряд",
    description: "Простой, уютный образ для повседневных сцен.",
    category: "outfit",
    characterId: "rin",
    price: 150,
    color: "#f9a8d4",
  },
  {
    id: "rin-outfit-formal",
    name: "Строгий наряд",
    description: "Для случаев, когда она хочет выглядеть увереннее, чем чувствует себя.",
    category: "outfit",
    characterId: "rin",
    price: 300,
    color: "#a5b4fc",
  },
  {
    id: "rin-decor-room",
    name: "Уютная комната",
    description: "Меняет обстановку сцены на более домашнюю.",
    category: "decor",
    characterId: "rin",
    price: 250,
    color: "#fca5a5",
  },
  {
    id: "ada-outfit-leather",
    name: "Кожаный образ",
    description: "То, во что она одевается, когда настроена не отступать.",
    category: "outfit",
    characterId: "ada",
    price: 300,
    color: "#7c3aed",
  },
  {
    id: "ada-outfit-elegant",
    name: "Вечерний наряд",
    description: "Для сцен, где экзамен превращается в свидание.",
    category: "outfit",
    characterId: "ada",
    price: 350,
    color: "#f472b6",
  },
  {
    id: "ada-decor-studio",
    name: "Её студия",
    description: "Фон, отражающий, что здесь распоряжается она.",
    category: "decor",
    characterId: "ada",
    price: 250,
    color: "#fb923c",
  },
  {
    id: "ada-collectible-token",
    name: "Памятный жетон",
    description: "Коллекционный предмет без игрового эффекта — просто на память.",
    category: "collectible",
    characterId: "ada",
    price: 500,
    color: "#facc15",
  },
];

export function accessoriesFor(characterId: string): Accessory[] {
  return ACCESSORIES.filter((a) => a.characterId === characterId);
}

export function getAccessory(accessoryId: string): Accessory | undefined {
  return ACCESSORIES.find((a) => a.id === accessoryId);
}
