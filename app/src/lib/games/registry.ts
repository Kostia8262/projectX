// Data-driven core: one engine per mechanic (SpankGame.tsx for fixed-cost
// taps, SpankGameRate.tsx for rate-based) + a config per pilot, plus a
// shared implement/stage catalog. Adding game #N = new entry here + new art
// later, no new code. Implements are placeholder shapes-with-a-label for
// now — real art/shaders come later per the user's own pipeline.
export type GameStatus = "available" | "coming-soon";
export type ImplementUnlock = "free" | "subscription" | "purchase";
// "fixed"/"rate" are the original two engines (SpankGame.tsx / SpankGameRate.tsx).
// "aim"/"rhythm"/"sequence" are Рин's free-play mechanic testbeds — each a
// separate engine component (SpankGameAim/Rhythm/Sequence.tsx) trying out a
// mechanic meant to be reused later in her chapters (see lib/content) once
// proven out here. Deliberately not added to Ада's pilots yet — one
// character's free-play pool is enough to iterate on before spreading it.
export type GameMechanic = "fixed" | "rate" | "aim" | "rhythm" | "sequence";

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

// "free" games are the open pool shown under "Свободная игра" on a
// character's page — playable any time, own default narrative (see
// STORIES in games/stories.ts). "chapter" games exist ONLY to be pointed at
// by a chapter's gameId (see lib/content) — never listed as free play, and
// carry no narrative of their own (a chapter always supplies its own
// independent story). Structural, like id/implementIds/mechanic — not
// something an admin patch should move between pools (see GameOverride).
export type GameType = "free" | "chapter";

export type GameDefinition = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: GameStatus;
  type: GameType;
  characterLabel: string;
  implementIds: string[];
  maxHeat: number;
  mechanic: GameMechanic;
};

// Admin-editable subset of GameDefinition (see app/admin/games and
// api/admin/games) — deliberately excludes `id`/`implementIds`/`mechanic`:
// those are structural, wired into other code (implementsFor, the
// fixed/rate engine choice in page.tsx), and editing them from a text field
// without validation could break a game rather than just reskin it.
export type GameOverride = Partial<Pick<GameDefinition, "status" | "title" | "tagline" | "description" | "maxHeat">>;

export function applyGameOverrides(
  games: GameDefinition[],
  overrides: Record<string, GameOverride>
): GameDefinition[] {
  return games.map((g) => (overrides[g.id] ? { ...g, ...overrides[g.id] } : g));
}

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
    tagline: "Она подсказывает, куда",
    description: "Она чуть двигается — цель смещается между заходами, попадите точно, а не куда попало.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж A (заглушка)",
    implementIds: ["hand", "ruler", "paddle"],
    maxHeat: 100,
    mechanic: "aim",
  },
  {
    id: "pilot-b",
    title: "Пилот B — Дисциплина",
    tagline: "Долгая сессия",
    description: "Нагрев растёт медленнее, зато доступны все орудия — проверка на затяжной прогресс.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж B (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 140,
    mechanic: "fixed",
  },
  {
    id: "pilot-c",
    title: "Пилот C — Быстрый раунд",
    tagline: "Поймайте момент",
    description: "Один инструмент, но точный момент важнее силы — попадите в нужную фазу, а не куда попало.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж C (заглушка)",
    implementIds: ["hand"],
    maxHeat: 60,
    mechanic: "rhythm",
  },
  {
    id: "pilot-d",
    title: "Пилот D — Учащение",
    tagline: "Расход в секунду",
    description:
      "Энергия и нагрев зависят от темпа: чем чаще шлепаете, тем дороже каждое действие, но и эффект сильнее. Персонаж отдельно реагирует на скорость, а не только на счётчик.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж D (заглушка)",
    implementIds: ["hand", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 100,
    mechanic: "rate",
  },
  // Full-roster test beds for Рин, mirroring pilot-b/pilot-d's "everything
  // unlocked" coverage for Ада — needed so the low-tolerance gate
  // (submission<25 blocks purchase-tier, see isImplementBlocked) and the
  // tolerance-mismatch math actually have somewhere to fire; her other two
  // games never expose an intense-tier implement at all. Free-play only —
  // chapters get their own dedicated "chapter"-type games below instead of
  // borrowing these directly (see lib/content).
  {
    id: "pilot-e",
    title: "Пилот E — Полное доверие",
    tagline: "Запомните, что она просит",
    description:
      "Она называет порядок орудий один раз — воссоздайте его в точности. Ошиблись — начинайте заново.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж E (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 140,
    mechanic: "sequence",
  },
  {
    id: "pilot-f",
    title: "Пилот F — Не сбавляя темп",
    tagline: "Держите её темп, не свой",
    description:
      "Она хочет конкретную скорость, не «максимальную» — цель на шкале темпа время от времени смещается, попадание в неё выгоднее слепой спешки.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж F (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 100,
    mechanic: "rate",
  },
  // Same "full-roster, own pace" pair for Ада as pilot-e/pilot-f are for
  // Рин. Free-play only, same reasoning as above.
  {
    id: "pilot-g",
    title: "Пилот G — Без экзамена",
    tagline: "Полное доверие",
    description:
      "Тот же полный набор орудий, что и в «Дисциплине», но без проверки — нагрев чуть выше прежнего предела, потому что на этот раз никто не сдерживается из принципа.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж G (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 160,
    mechanic: "fixed",
  },
  {
    id: "pilot-h",
    title: "Пилот H — Без брони",
    tagline: "Свой темп, без счёта",
    description: "Полный набор на механике по темпу — темп в этот раз держит она сама, и не для того, чтобы что-то доказать.",
    status: "available",
    type: "free",
    characterLabel: "Персонаж H (заглушка)",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 120,
    mechanic: "rate",
  },

  // Dedicated placeholder games for story mode — one per chapter (4 per
  // character), never shown under "Свободная игра" (see CharacterPage.tsx's
  // type === "free" filter). Each mirrors the maxHeat/mechanic/implementIds
  // of the free-play pilot the chapter used to borrow directly, so existing
  // balance carries over; only title/tagline/description are placeholders
  // pending real chapter-specific content.
  {
    id: "chapter-rin-1",
    title: "Глава 1 — Рин (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под первую главу Рин — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Рин",
    implementIds: ["hand", "ruler", "paddle"],
    maxHeat: 100,
    mechanic: "fixed",
  },
  {
    id: "chapter-rin-2",
    title: "Глава 2 — Рин (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под вторую главу Рин — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Рин",
    implementIds: ["hand"],
    maxHeat: 60,
    mechanic: "fixed",
  },
  {
    id: "chapter-rin-3",
    title: "Глава 3 — Рин (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под третью главу Рин — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Рин",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 140,
    mechanic: "fixed",
  },
  {
    id: "chapter-rin-4",
    title: "Глава 4 — Рин (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под четвёртую главу Рин — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Рин",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 100,
    mechanic: "rate",
  },
  {
    id: "chapter-ada-1",
    title: "Глава 1 — Ада (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под первую главу Ады — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Ада",
    implementIds: ["hand", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 100,
    mechanic: "rate",
  },
  {
    id: "chapter-ada-2",
    title: "Глава 2 — Ада (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под вторую главу Ады — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Ада",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 140,
    mechanic: "fixed",
  },
  {
    id: "chapter-ada-3",
    title: "Глава 3 — Ада (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под третью главу Ады — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Ада",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 160,
    mechanic: "fixed",
  },
  {
    id: "chapter-ada-4",
    title: "Глава 4 — Ада (заглушка)",
    tagline: "Плейсхолдер главы",
    description: "Заглушка под четвёртую главу Ады — заменить на реальный контент.",
    status: "available",
    type: "chapter",
    characterLabel: "Ада",
    implementIds: ["hand", "ruler", "paddle", "brush", "belt", "flogger", "cane", "riding-crop", "paddle-studded"],
    maxHeat: 120,
    mechanic: "rate",
  },
];

export function getGame(gameId: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === gameId);
}
