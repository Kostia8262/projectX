// Per-tap history for a single round, aggregated at finale time into a
// coarse read on HOW the round was played — not just how fast (see
// RoundResult in stories.ts) or which implement was last selected, but
// whether the whole sequence reads as a deliberate combination or a
// primitive spam of one button while ignoring gates. Feeds resolveStoryVariant
// alongside the character's own mood (see characters/traits.ts's moodTag) —
// neither signal alone is enough to justify a genuinely different finale.
export type TapOutcome = {
  implementId: string;
  blocked: boolean; // player tried a gated implement (implementBlockReason fired)
  matched: boolean; // matchesTolerance for this tap — irrelevant (false) when blocked
  resonant: boolean; // implement is in character.preferredImplementIds
};

export type SessionQuality = "masterful" | "clumsy" | "neutral";

const MASTERFUL_MIN_DISTINCT = 3;
const CLUMSY_SPAM_MIN_TAPS = 4;
const CLUMSY_MISMATCH_RATIO = 0.5;

export function classifySessionQuality(taps: TapOutcome[], poolSize: number): SessionQuality {
  const successful = taps.filter((t) => !t.blocked);
  if (successful.length === 0) return "neutral";

  const blockedCount = taps.length - successful.length;
  const mismatchRatio = successful.filter((t) => !t.matched).length / successful.length;
  const distinctImplements = new Set(successful.map((t) => t.implementId)).size;

  // Ignoring gates, or hammering one implement, or systematically missing
  // tolerance — the "primitive clicking" case, regardless of pace.
  if (blockedCount > 0 || mismatchRatio > CLUMSY_MISMATCH_RATIO) return "clumsy";
  if (distinctImplements === 1 && successful.length >= CLUMSY_SPAM_MIN_TAPS) return "clumsy";

  // Variety alone isn't mastery — it also has to include at least one
  // implement she actually prefers, and zero tolerance mismatches.
  const resonantRatio = successful.filter((t) => t.resonant).length / successful.length;
  if (
    distinctImplements >= Math.min(MASTERFUL_MIN_DISTINCT, poolSize) &&
    mismatchRatio === 0 &&
    resonantRatio > 0
  ) {
    return "masterful";
  }

  return "neutral";
}
