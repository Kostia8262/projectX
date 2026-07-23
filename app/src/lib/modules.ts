// Whole top-level pages that an admin can switch off from the "Модули"
// admin tab (support/testing lever — e.g. hide the shop while accessories
// are being reworked, without a deploy). Deliberately a short, hardcoded
// list rather than something dynamic: these are structural app sections,
// not content, so growing this list is a code change same as adding a new
// top-level view in app/page.tsx.
export type ModuleId = "shop" | "subscription";

export const MODULES: { id: ModuleId; label: string; description: string }[] = [
  { id: "shop", label: "Магазин", description: "Покупка аксессуаров за монеты" },
  { id: "subscription", label: "Подписка", description: "Платные тарифы и их оформление" },
];

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && MODULES.some((m) => m.id === value);
}
