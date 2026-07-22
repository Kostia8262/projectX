// Data-driven core: one engine per mechanic (SpankGame.tsx for fixed-cost
// taps, SpankGameRate.tsx for rate-based) + a config per pilot, plus a
// shared implement/stage catalog. Adding game #N = new entry here + new art
// later, no new code. Implements are placeholder shapes-with-a-label for
// now — real art/shaders come later per the user's own pipeline.
export type GameStatus = "available" | "coming-soon";
export type ImplementUnlock = "free" | "subscription" | "purchase";
export type GameMechanic = "fixed" | "rate";

export type Implement = {
  id: string;
  name: string;
  heatPerHit: number;
  unlock: ImplementUnlock;
  color: string;
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
  { id: "hand", name: "Рука", heatPerHit: 4, unlock: "free", color: "#f472b6" },
  { id: "paddle", name: "Шлёпалка", heatPerHit: 7, unlock: "subscription", color: "#f97316" },
  { id: "flogger", name: "Плётка", heatPerHit: 10, unlock: "purchase", color: "#a855f7" },
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

export const GAMES: GameDefinition[] = [
  {
    id: "pilot-a",
    title: "Пилот A — Знакомство",
    tagline: "Базовый темп",
    description: "Стандартный набор орудий, ровный набор нагрева — опорная версия для сравнения с остальными.",
    status: "available",
    characterLabel: "Персонаж A (заглушка)",
    implementIds: ["hand", "paddle"],
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
    implementIds: ["hand", "paddle", "flogger"],
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
    implementIds: ["hand", "paddle", "flogger"],
    maxHeat: 100,
    mechanic: "rate",
  },
];

export function getGame(gameId: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === gameId);
}
