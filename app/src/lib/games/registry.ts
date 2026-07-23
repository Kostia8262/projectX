// Data-driven core: one engine per mechanic (SpankGame.tsx for fixed-cost
// taps, SpankGameRate.tsx for rate-based) + a config per pilot, plus a
// shared implement/stage catalog. Adding game #N = new entry here + new art
// later, no new code. Implements are placeholder shapes-with-a-label for
// now — real art/shaders come later per the user's own pipeline.
export type GameStatus = "available" | "coming-soon";
export type ImplementUnlock = "free" | "subscription" | "purchase";
export type GameMechanic = "fixed" | "rate";

// Lives here (not traits.ts) because it's fundamentally a property of the
// implement/pace combo, not of the character reacting to it — see
// classifyIntensity in traits.ts for how it's derived.
export type RoundIntensity = "gentle" | "moderate" | "intense";

// The economy: every implement pushes ALL FIVE character traits at once, in
// different directions, instead of one implement = one stat. Nothing here is
// a pure upside — each vector has a clear strength axis and a clear cost, so
// switching implements is a real trade-off rather than a linear power scale.
// See docs/Черты персонажей.md for the full design rationale.
export type ImplementVector = {
  pleasure: number;
  submission: number;
  boredomRelief: number; // how much this implement can cut into accumulated Boredom
  defianceRisk: number; // baseline Defiance pressure this implement carries
  affection: number;
};

export type Implement = {
  id: string;
  name: string;
  heatPerHit: number;
  unlock: ImplementUnlock;
  color: string;
  intensityTier: RoundIntensity;
  vector: ImplementVector;
  // "Freshness" is a per-implement resource, same regenerate-on-read pattern
  // as energy/boredom: using an implement spends charge, real elapsed hours
  // regenerate it. Low charge discounts pleasure/boredomRelief (see
  // freshnessMultiplier in traits.ts) — repetition dulls an implement even
  // if it's otherwise a great fit for the character.
  freshnessCost: number;
  freshnessRegenPerHour: number;
};

export type HeatStage = {
  threshold: number;
  label: string;
  color: string;
};

// Pace stages are a SEPARATE axis from heat — heat tracks cumulative
// progress toward the round's climax, pace tracks how fast the player is
// acting right now. A "rate" mechanic game reacts to both independently:
// heat says how far along the scene is, pace says how the character is
// handling the current speed of it.
export type PaceStage = {
  threshold: number;
  label: string;
};

export type GameDefinition = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: GameStatus;
  characterLabel: string;
  implementIds: string[];
  maxHeat: number;
  mechanic: GameMechanic;
};

// Shared across every pilot — a "purchase"-gated implement is a real,
// separate business decision from the subscription itself (per the user's
// "actions can be paid for/intensified separately" direction).
export const IMPLEMENTS: Implement[] = [
  {
    id: "hand",
    name: "Рука",
    heatPerHit: 4,
    unlock: "free",
    color: "#f472b6",
    intensityTier: "gentle",
    vector: { pleasure: 2, submission: 4, boredomRelief: 3, defianceRisk: 0, affection: 3 },
    freshnessCost: 10,
    freshnessRegenPerHour: 20,
  },
  {
    id: "ruler",
    name: "Линейка",
    heatPerHit: 5,
    unlock: "free",
    color: "#facc15",
    intensityTier: "gentle",
    vector: { pleasure: 3, submission: 1, boredomRelief: 4, defianceRisk: 3, affection: 2 },
    freshnessCost: 10,
    freshnessRegenPerHour: 20,
  },
  {
    id: "paddle",
    name: "Шлёпалка",
    heatPerHit: 7,
    unlock: "subscription",
    color: "#f97316",
    intensityTier: "moderate",
    vector: { pleasure: 5, submission: 3, boredomRelief: 5, defianceRisk: 2, affection: 1 },
    freshnessCost: 15,
    freshnessRegenPerHour: 12,
  },
  {
    id: "brush",
    name: "Щётка для волос",
    heatPerHit: 6,
    unlock: "subscription",
    color: "#38bdf8",
    intensityTier: "gentle",
    vector: { pleasure: 3, submission: 2, boredomRelief: 2, defianceRisk: 0, affection: 6 },
    freshnessCost: 15,
    freshnessRegenPerHour: 12,
  },
  {
    id: "belt",
    name: "Ремень",
    heatPerHit: 8,
    unlock: "subscription",
    color: "#78350f",
    intensityTier: "moderate",
    vector: { pleasure: 4, submission: 6, boredomRelief: 4, defianceRisk: 3, affection: -1 },
    freshnessCost: 15,
    freshnessRegenPerHour: 12,
  },
  {
    id: "flogger",
    name: "Плётка",
    heatPerHit: 10,
    unlock: "purchase",
    color: "#a855f7",
    intensityTier: "intense",
    vector: { pleasure: 7, submission: 2, boredomRelief: 6, defianceRisk: 4, affection: -1 },
    freshnessCost: 20,
    freshnessRegenPerHour: 8,
  },
  {
    id: "cane",
    name: "Трость",
    heatPerHit: 12,
    unlock: "purchase",
    color: "#65a30d",
    intensityTier: "intense",
    // Steepest cost/regen in the set on purpose — a "special occasion" item
    // that punishes spamming hardest, see freshnessMultiplier.
    vector: { pleasure: 8, submission: 1, boredomRelief: 8, defianceRisk: 5, affection: -2 },
    freshnessCost: 35,
    freshnessRegenPerHour: 4,
  },
  {
    id: "riding-crop",
    name: "Стек",
    heatPerHit: 11,
    unlock: "purchase",
    color: "#1e293b",
    intensityTier: "moderate",
    // Only implement with a strong bonus on BOTH Pleasure and Submission —
    // the signature "power item" for a control-reads-as-care character.
    vector: { pleasure: 6, submission: 5, boredomRelief: 5, defianceRisk: 3, affection: 1 },
    freshnessCost: 20,
    freshnessRegenPerHour: 8,
  },
  {
    id: "paddle-studded",
    name: "Шипастая шлёпалка",
    heatPerHit: 14,
    unlock: "purchase",
    color: "#dc2626",
    // The real cost here — a negative Submission base, not just a risk —
    // reflects that using it carelessly can actively undermine trust.
    intensityTier: "intense",
    vector: { pleasure: 9, submission: -1, boredomRelief: 7, defianceRisk: 6, affection: -3 },
    freshnessCost: 35,
    freshnessRegenPerHour: 4,
  },
];

export const HEAT_STAGES: HeatStage[] = [
  { threshold: 0, label: "Спокойно", color: "#94a3b8" },
  { threshold: 25, label: "Вздрагивает", color: "#f472b6" },
  { threshold: 50, label: "Стонет", color: "#ec4899" },
  { threshold: 75, label: "Умоляет", color: "#d946ef" },
  { threshold: 95, label: "Предел", color: "#f43f5e" },
];

// Threshold is in smoothed taps-per-second.
export const PACE_STAGES: PaceStage[] = [
  { threshold: 0, label: "Неспешно" },
  { threshold: 1, label: "Ритм нарастает" },
  { threshold: 2.5, label: "Сбивается дыхание" },
  { threshold: 4.5, label: "На пределе темпа" },
];

export function stageForHeat(heat: number): HeatStage {
  let current = HEAT_STAGES[0];
  for (const s of HEAT_STAGES) if (heat >= s.threshold) current = s;
  return current;
}

export function paceForRate(rate: number): PaceStage {
  let current = PACE_STAGES[0];
  for (const s of PACE_STAGES) if (rate >= s.threshold) current = s;
  return current;
}

export function implementsFor(game: GameDefinition): Implement[] {
  return IMPLEMENTS.filter((i) => game.implementIds.includes(i.id));
}

export function getImplement(implementId: string): Implement | undefined {
  return IMPLEMENTS.find((i) => i.id === implementId);
}

export const GAMES: GameDefinition[] = [
  {
    id: "pilot-a",
    title: "Пилот A — Знакомство",
    tagline: "Базовый темп",
    description: "Стандартный набор орудий, ровный набор нагрева — опорная версия для сравнения с остальными.",
    status: "available",
    characterLabel: "Персонаж A (заглушка)",
    implementIds: ["hand", "ruler", "paddle"],
    maxHeat: 100,
    mechanic: "fixed",
  },
  {
    id: "pilot-b",
    title: "Пилот B — Дисциплина",
    tagline: "Долгая сессия",
    description: "Нагрев растёт медленнее, зато доступны все орудия — проверка на затяжной прогресс.",
    status: "available",
    characterLabel: "Персонаж B (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 140,
    mechanic: "fixed",
  },
  {
    id: "pilot-c",
    title: "Пилот C — Быстрый раунд",
    tagline: "Только рука",
    description: "Один инструмент, высокий нагрев за касание — проверка короткой, «на пару минут», сессии.",
    status: "available",
    characterLabel: "Персонаж C (заглушка)",
    implementIds: ["hand"],
    maxHeat: 60,
    mechanic: "fixed",
  },
  {
    id: "pilot-d",
    title: "Пилот D — Учащение",
    tagline: "Расход в секунду",
    description:
      "Энергия и нагрев зависят от темпа: чем чаще шлепаете, тем дороже каждое действие, но и эффект сильнее. Персонаж отдельно реагирует на скорость, а не только на счётчик.",
    status: "available",
    characterLabel: "Персонаж D (заглушка)",
    implementIds: ["hand", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 100,
    mechanic: "rate",
  },
];

export function getGame(gameId: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === gameId);
}
