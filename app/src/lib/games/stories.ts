import type { SessionQuality } from "./sessionQuality";

// One narrative frame per pilot: a short intro shown before the first round
// of a session, and a small set of finale variants chosen from how the round
// was actually played (speed, implement in use at the finish). Content stays
// pure data — resolveStoryVariant carries the matching logic — so the copy
// itself is easy to hand off for a real rewrite later.
export type RoundResult = {
  durationMs: number;
  implementId: string;
  averagePace: number; // 0 for fixed-mechanic games, smoothed taps/sec for "rate"
};

// The 4 "masterful-*"/"clumsy-*" tags combine session quality (see
// games/sessionQuality.ts) with the character's mood snapshot (see
// characters/traits.ts's moodTag) — checked ahead of implement/fast/slow in
// resolveStoryVariant below, but only fire when both signals are provided
// and the session was clearly good or clearly bad, not the average case.
export type StoryTag =
  | "fast"
  | "slow"
  | `implement-${string}`
  | "masterful-warm"
  | "masterful-cold"
  | "clumsy-warm"
  | "clumsy-cold";

// A single narrative beat: text plus an optional image. Shared by both the
// pilot's own free-play story (STORIES below, image always unset — no admin
// editing here) and a chapter's independent story (lib/content — admin can
// attach an image per beat there). One shape, two owners.
export type StoryBeat = { text: string; image?: string };

export type GameStory = {
  intro: StoryBeat;
  variants: Partial<Record<StoryTag, StoryBeat>>;
  fallback: StoryBeat;
};

export const STORIES: Record<string, GameStory> = {
  "pilot-a": {
    intro: {
      text: "Первая встреча. Она новенькая — любопытная, но осторожная. Сегодня только пробное знакомство: посмотрим, как быстро она расслабится.",
    },
    variants: {
      fast: { text: "Не ожидала, что так быстро войдёт во вкус — щёки горят, а взгляд просит продолжения." },
      slow: { text: "Каждое касание она встречала с нарастающим доверием — к финалу подставилась под последний шлепок уже сама." },
      "implement-paddle": { text: "Смена руки на шлёпалку застаёт её врасплох — короткое «ой», и тут же вызов в глазах вместо просьбы остановиться." },
    },
    fallback: {
      text: "Она молчит на пару секунд дольше, чем нужно — не от неловкости, а потому что не хочет, чтобы момент так быстро заканчивался. Ловит ваш взгляд и первой отводит свой.",
    },
  },
  "pilot-b": {
    intro: {
      text: "Она снова опоздала — и снова с оправданиями. Сегодня разговор будет коротким: дисциплина, никаких поблажек. Готовы все орудия — посмотрим, сколько продержится её бравада.",
    },
    variants: {
      "implement-flogger": { text: "К плётке она пришла сама — бравада сломалась где-то на середине, осталась только мольба." },
      "implement-cane": { text: "Трость выбивает первый настоящий вскрик за вечер — бравада исчезает мгновенно, а вместо неё оседает то самое молчаливое уважение, которое она обычно скрывает получше." },
      slow: { text: "Смягчилась не сразу — но к финалу дерзость сменилась почти нежной покорностью." },
      fast: { text: "Сдалась быстрее, чем ожидала сама — видимо, не так уж и хотела сопротивляться." },
    },
    fallback: {
      text: "Она выпрямляется, поправляет растрепавшиеся волосы — бравада возвращается на место, но чуть медленнее обычного. Оба заметили эту паузу, и оба сделали вид, что нет.",
    },
  },
  "pilot-c": {
    intro: {
      text: "Пять минут до звонка в дверь. Ни секунды на подготовку — только рука и решимость успеть до того, как кто-то войдёт.",
    },
    variants: {
      fast: { text: "Успели тютелька в тютельку — она поправляет юбку за секунду до того, как поворачивается дверная ручка." },
      slow: { text: "Затянули — в дверь уже стучат, а она пытается сдержать смех и румянец одновременно." },
    },
    fallback: {
      text: "Вы оба замираете на полсекунды дольше положенного — а звук шагов за дверью возвращает в реальность быстрее, чем хотелось бы.",
    },
  },
  "pilot-d": {
    intro: {
      text: "Игра на выдержку — кто первым собьётся с ритма? Она обещала не считать удары вслух, только следить за собственным дыханием. Ваша задача — сбить её со счёта.",
    },
    variants: {
      "implement-flogger": { text: "Плётка появляется на середине счёта — и тут она сбивается сама, впервые растеряв нить, которую держала все прошлые разы." },
      fast: { text: "Ритм захватил её быстрее, чем она успела опомниться — сбилась со счёта уже на середине, дыхание частое, взгляд затуманен." },
      slow: { text: "Держала себя в руках до последнего — выдержка почти безупречна, лишь едва заметная дрожь в голосе выдаёт напряжение." },
    },
    fallback: { text: "То ускоряясь, то позволяя себе передышку — довела её до предела осознанно, шаг за шагом." },
  },
  // Full-roster test beds for Рин — see the comment on pilot-e/pilot-f in
  // games/registry.ts for why they exist. Framed as the payoff of the trust
  // built in pilot-a/pilot-c: she's the one asking to try the rest of the
  // set now, not being pushed into it.
  "pilot-e": {
    intro: {
      text: "Сегодня она сама попросила: «Хочу попробовать всё, чего раньше боялась». На столе — весь набор, не только то, к чему она уже привыкла.",
    },
    variants: {
      fast: { text: "Не ожидала от себя такой смелости — переходит от одного орудия к другому почти без паузы, будто наверстывает упущенное время." },
      slow: { text: "Просит не торопиться — по одному, по очереди, чтобы прочувствовать разницу между тем, что знакомо, и тем, что пока пугает." },
      "implement-cane": { text: "Трость застаёт её врасплох — вдох сквозь зубы, а следом нервный смех: «Я и не знала, что так можно»." },
      "implement-paddle-studded": { text: "Смотрит на шипастую шлёпалку дольше, чем нужно, прежде чем кивнуть — «Только медленно, ладно?»" },
    },
    fallback: {
      text: "К концу она сама удивлена, как далеко зашла за один вечер — ещё утром половина этого набора казалась ей чем-то из чужой жизни.",
    },
  },
  "pilot-f": {
    intro: {
      text: "Тот же полный набор, но без пауз между ударами — она сама выбрала темп сегодня, а не подстраивалась под чужой.",
    },
    variants: {
      fast: { text: "Ритм несёт её быстрее, чем она рассчитывала — там, где раньше просила паузу, сегодня только просит не останавливаться." },
      slow: { text: "Держит собственный темп осознанно — пробует каждое орудие на вкус, не позволяя скорости смазать ощущения." },
    },
    fallback: { text: "Между ускорениями и передышками она ищет свой ритм — не тот, что вы задаёте, а свой собственный, и им заметно гордится." },
  },
  // Ада's own "no more testing" pair — see the comment on pilot-g/pilot-h in
  // games/registry.ts. Voice stays dry and precise even here; the shift is
  // in what she's doing (choosing, not examining), not in how she talks.
  "pilot-g": {
    intro: {
      text: "Ежедневник сегодня остался закрытым — нечего вносить в «критерии». Весь набор на столе, без экзамена: не потому что должны доказать, а потому что она сама так решила.",
    },
    variants: {
      "implement-cane": { text: "Трость она выбирает сама, не дожидаясь предложения — впервые не проверка, а прямое желание." },
      fast: { text: "Проходит весь набор почти без пауз для эффекта — будто наверстывает то, что раньше держала под контролем из принципа." },
      slow: { text: "Ни разу не торопит за весь вечер — редкость для той, кто привыкла мерить время как ресурс." },
    },
    fallback: {
      text: "К концу вечера она не тянется за ежедневником — просто остаётся рядом чуть дольше обычного, и это говорит больше, чем любая запись в нём могла бы.",
    },
  },
  "pilot-h": {
    intro: {
      text: "Тот же полный набор, но без пауз между заходами — задавать темп сегодня не её работа, и она явно не против того, что не должна.",
    },
    variants: {
      fast: { text: "Отпускает контроль над темпом быстрее, чем ожидала от себя — рабочая броня трещит на глазах, и она даже не пытается её удержать." },
      slow: { text: "Держит собственный ритм осознанно — но не для проверки, а потому что так честнее для неё самой." },
    },
    fallback: { text: "Между ускорениями она давно перестала считать — как будто наконец разрешила себе не вести счёт ни ударам, ни себе самой." },
  },
};

// Duration thresholds are per-game since maxHeat/implement mix differ; these
// are first-pass estimates for a human tap rate, not tuned telemetry.
// pilot-e reuses pilot-b's numbers — same maxHeat, same full implement pool.
// Each chapter-* id mirrors the numbers of the free-play pilot it copied its
// maxHeat/implementIds from (see games/registry.ts) — same reasoning.
const FAST_UNDER_MS: Record<string, number> = {
  "pilot-a": 15000,
  "pilot-b": 25000,
  "pilot-c": 8000,
  "pilot-e": 25000,
  "pilot-g": 28000,
  "chapter-rin-1": 15000, // mirrors pilot-a
  "chapter-rin-2": 8000, // mirrors pilot-c
  "chapter-rin-3": 25000, // mirrors pilot-e
  "chapter-ada-2": 25000, // mirrors pilot-b
  "chapter-ada-3": 28000, // mirrors pilot-g
};
const SLOW_OVER_MS: Record<string, number> = {
  "pilot-a": 45000,
  "pilot-b": 70000,
  "pilot-c": 25000,
  "pilot-e": 70000,
  "pilot-g": 80000,
  "chapter-rin-1": 45000,
  "chapter-rin-2": 25000,
  "chapter-rin-3": 70000,
  "chapter-ada-2": 70000,
  "chapter-ada-3": 80000,
};
const FAST_PACE = 2.5;
const SLOW_PACE = 1;
// Both "rate"-mechanic games (see games/registry.ts) use pace, not duration,
// to pick a variant. chapter-rin-4/chapter-ada-1/chapter-ada-4 mirror
// pilot-f/pilot-d/pilot-h's mechanic for the same reason as the thresholds
// above.
const RATE_MECHANIC_GAME_IDS = new Set([
  "pilot-d",
  "pilot-f",
  "pilot-h",
  "chapter-rin-4",
  "chapter-ada-1",
  "chapter-ada-4",
]);

// `story` is a parameter (not looked up from STORIES internally) so the same
// matching logic works for both a pilot's free-play story AND a chapter's
// independent one — only the pacing thresholds stay keyed by gameId, since
// those calibrate the MECHANIC, not the narrative source.
//
// `mood`/`sessionQuality` are optional and checked first, ahead of the
// implement tag — a clear "she's unhappy" or "that was masterful" signal
// says more than which implement happened to land the final hit. Neither
// param is required: callers that don't pass them (or pilots whose
// `variants` never define these combo tags) fall straight through to the
// pre-existing implement/fast/slow/fallback behavior, unchanged.
export function resolveStoryVariant(
  story: GameStory,
  gameId: string,
  result: RoundResult,
  mood?: "warm" | "cold",
  sessionQuality?: SessionQuality
): StoryBeat {
  if (mood && sessionQuality && sessionQuality !== "neutral") {
    const comboTag = `${sessionQuality}-${mood}` as StoryTag;
    const comboVariant = story.variants[comboTag];
    if (comboVariant) return comboVariant;
  }

  const implementTag = `implement-${result.implementId}` as StoryTag;
  const implementVariant = story.variants[implementTag];
  if (implementVariant) return implementVariant;

  if (RATE_MECHANIC_GAME_IDS.has(gameId)) {
    if (result.averagePace >= FAST_PACE && story.variants.fast) return story.variants.fast;
    if (result.averagePace <= SLOW_PACE && story.variants.slow) return story.variants.slow;
    return story.fallback;
  }

  const fastUnder = FAST_UNDER_MS[gameId];
  const slowOver = SLOW_OVER_MS[gameId];
  if (fastUnder && result.durationMs <= fastUnder && story.variants.fast) return story.variants.fast;
  if (slowOver && result.durationMs >= slowOver && story.variants.slow) return story.variants.slow;
  return story.fallback;
}
