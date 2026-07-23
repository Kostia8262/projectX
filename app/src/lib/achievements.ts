import type { TraitState } from "@/lib/characters/traits";

// Computed live from existing data every time the tab opens — not a
// separately-tracked "unlocked at time X" event log. Honest simplification
// for a first pass: if a stat later drops back down, the achievement
// disappears too. Fine for now since nothing here is a real reward, just
// a status display.
export type Achievement = {
  id: string;
  title: string;
  description: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-step", title: "Первый шаг", description: "Сыграли хотя бы один раунд." },
  { id: "response-1", title: "Отклик I", description: "Набрали 150 в общем Отклике." },
  { id: "response-2", title: "Отклик II", description: "Набрали 600 в общем Отклике." },
  { id: "response-3", title: "Отклик III", description: "Набрали 1500 в общем Отклике." },
  { id: "trust", title: "Её доверие", description: "Подчинение 60+ хотя бы у одного персонажа." },
  { id: "mutual", title: "Взаимная влюблённость", description: "Влюблённость 70+ хотя бы у одного персонажа." },
  { id: "collector", title: "Коллекционер", description: "Владеете тремя и более аксессуарами." },
  { id: "registered", title: "Добро пожаловать", description: "Активировали бесплатный тариф подписки." },
];

export function computeUnlocked(ctx: {
  affinity: number;
  traitsByCharacter: TraitState[];
  ownedCount: number;
  freePlanActivated: boolean;
}): Set<string> {
  const unlocked = new Set<string>();
  if (ctx.affinity > 0) unlocked.add("first-step");
  if (ctx.affinity >= 150) unlocked.add("response-1");
  if (ctx.affinity >= 600) unlocked.add("response-2");
  if (ctx.affinity >= 1500) unlocked.add("response-3");
  if (ctx.traitsByCharacter.some((t) => t.submission >= 60)) unlocked.add("trust");
  if (ctx.traitsByCharacter.some((t) => t.affection >= 70)) unlocked.add("mutual");
  if (ctx.ownedCount >= 3) unlocked.add("collector");
  if (ctx.freePlanActivated) unlocked.add("registered");
  return unlocked;
}
