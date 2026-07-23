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

type StoryTag = "fast" | "slow" | `implement-${string}`;

export type GameStory = {
  intro: string;
  variants: Partial<Record<StoryTag, string>>;
  fallback: string;
};

export const STORIES: Record<string, GameStory> = {
  "pilot-a": {
    intro:
      "Первая встреча. Она новенькая — любопытная, но осторожная. Сегодня только пробное знакомство: посмотрим, как быстро она расслабится.",
    variants: {
      fast: "Не ожидала, что так быстро войдёт во вкус — щёки горят, а взгляд просит продолжения.",
      slow: "Каждое касание она встречала с нарастающим доверием — к финалу подставилась под последний шлепок уже сама.",
      "implement-paddle": "Смена руки на шлёпалку застаёт её врасплох — короткое «ой», и тут же вызов в глазах вместо просьбы остановиться.",
    },
    fallback:
      "Она молчит на пару секунд дольше, чем нужно — не от неловкости, а потому что не хочет, чтобы момент так быстро заканчивался. Ловит ваш взгляд и первой отводит свой.",
  },
  "pilot-b": {
    intro:
      "Она снова опоздала — и снова с оправданиями. Сегодня разговор будет коротким: дисциплина, никаких поблажек. Готовы все орудия — посмотрим, сколько продержится её бравада.",
    variants: {
      "implement-flogger": "К плётке она пришла сама — бравада сломалась где-то на середине, осталась только мольба.",
      slow: "Смягчилась не сразу — но к финалу дерзость сменилась почти нежной покорностью.",
      fast: "Сдалась быстрее, чем ожидала сама — видимо, не так уж и хотела сопротивляться.",
    },
    fallback:
      "Она выпрямляется, поправляет растрепавшиеся волосы — бравада возвращается на место, но чуть медленнее обычного. Оба заметили эту паузу, и оба сделали вид, что нет.",
  },
  "pilot-c": {
    intro:
      "Пять минут до звонка в дверь. Ни секунды на подготовку — только рука и решимость успеть до того, как кто-то войдёт.",
    variants: {
      fast: "Успели тютелька в тютельку — она поправляет юбку за секунду до того, как поворачивается дверная ручка.",
      slow: "Затянули — в дверь уже стучат, а она пытается сдержать смех и румянец одновременно.",
    },
    fallback:
      "Вы оба замираете на полсекунды дольше положенного — а звук шагов за дверью возвращает в реальность быстрее, чем хотелось бы.",
  },
  "pilot-d": {
    intro:
      "Игра на выдержку — кто первым собьётся с ритма? Она обещала не считать удары вслух, только следить за собственным дыханием. Ваша задача — сбить её со счёта.",
    variants: {
      fast: "Ритм захватил её быстрее, чем она успела опомниться — сбилась со счёта уже на середине, дыхание частое, взгляд затуманен.",
      slow: "Держала себя в руках до последнего — выдержка почти безупречна, лишь едва заметная дрожь в голосе выдаёт напряжение.",
    },
    fallback: "То ускоряясь, то позволяя себе передышку — довела её до предела осознанно, шаг за шагом.",
  },
};

// Duration thresholds are per-game since maxHeat/implement mix differ; these
// are first-pass estimates for a human tap rate, not tuned telemetry.
const FAST_UNDER_MS: Record<string, number> = { "pilot-a": 15000, "pilot-b": 25000, "pilot-c": 8000 };
const SLOW_OVER_MS: Record<string, number> = { "pilot-a": 45000, "pilot-b": 70000, "pilot-c": 25000 };
const FAST_PACE = 2.5;
const SLOW_PACE = 1;

export function resolveStoryVariant(gameId: string, result: RoundResult): string {
  const story = STORIES[gameId];
  if (!story) return "";

  const implementTag = `implement-${result.implementId}` as StoryTag;
  const implementVariant = story.variants[implementTag];
  if (implementVariant) return implementVariant;

  if (gameId === "pilot-d") {
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
