import type { TraitState } from "@/lib/characters/traits";

export type TraitBarSpec = {
  key: keyof Omit<TraitState, "lastActiveAt">;
  label: string;
  color: string;
  // some traits read as "good" high (affection, submission, pleasure),
  // others "bad" high (boredom, defiance) — flips the bar's tone accordingly
  invert?: boolean;
};

// Shared between CharacterPage (compact card) and CharacterHistoryPage (full
// stat readout) so the two never drift on labels/colors/order.
export const TRAIT_BARS: TraitBarSpec[] = [
  { key: "submission", label: "Подчинение", color: "#818cf8" },
  { key: "pleasure", label: "Удовольствие", color: "#f472b6" },
  { key: "affection", label: "Влюблённость", color: "#fb7185" },
  { key: "boredom", label: "Скука", color: "#94a3b8", invert: true },
  { key: "defiance", label: "Дерзость", color: "#f97316", invert: true },
];
