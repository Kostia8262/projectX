import type { CharacterDefinition } from "./registry";
import type { Implement, RoundIntensity } from "../games/registry";
import type { SessionQuality } from "../games/sessionQuality";

// Five traits, deliberately coupled rather than independent — see the
// per-field comments below for *why* each one moves the way it does.
export type TraitState = {
  submission: number; // Подчинение
  pleasure: number; // Удовольствие
  boredom: number; // Скука
  defiance: number; // Дерзость
  affection: number; // Влюблённость
  lastActiveAt: number;
};

const MIN = 0;
const MAX = 100;
function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, n));
}

type InitialTraitProfile = Omit<TraitState, "lastActiveAt">;

// Starting point differs per character, not just how fast traits move from
// there. Рин already chose you after weeks of watching — some initial
// warmth, low defiance, she's not confrontational by nature. Ада opens on
// her own "exam" framing — higher defiance, lower trust, and a pre-set
// boredom baseline since she's already seen partners before you.
const INITIAL_TRAITS_BY_CHARACTER: Record<string, InitialTraitProfile> = {
  rin: { submission: 15, pleasure: 15, boredom: 0, defiance: 5, affection: 20 },
  ada: { submission: 10, pleasure: 15, boredom: 10, defiance: 20, affection: 10 },
};

// Fallback for any character without a defined profile above — degrades to
// the old flat defaults instead of crashing.
const DEFAULT_INITIAL_TRAITS: InitialTraitProfile = {
  submission: 15,
  pleasure: 15,
  boredom: 0,
  defiance: 10,
  affection: 15,
};

export function createInitialTraits(character: CharacterDefinition): TraitState {
  const profile = INITIAL_TRAITS_BY_CHARACTER[character.id] ?? DEFAULT_INITIAL_TRAITS;
  return { ...profile, lastActiveAt: Date.now() };
}

const BOREDOM_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 12,
  slow: 4.5,
};

// Defiance cools off passively too — reuses the same fast/slow axis as
// Boredom (a character who gets bored quickly also forgives quickly; a
// character who stays interested longer also holds a grudge longer).
const DEFIANCE_COOLDOWN_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 2,
  slow: 1,
};

// Below this many hours since the last round, being away reads as a normal
// break, not neglect — Affection/Submission don't move at all yet. Boredom
// and Defiance are exempt from this grace window on purpose: missing you a
// little right away is fine, actual distancing only starts after real absence.
const NEGLECT_GRACE_HOURS = 48;

// Same fast/slow axis as Boredom/Defiance above — a character who gets bored
// quickly is also the one who reads silence as "did I do something wrong,"
// so her trust erodes faster than a more independent character's would.
const AFFECTION_DECAY_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 0.35,
  slow: 0.15,
};
const SUBMISSION_DECAY_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 0.25,
  slow: 0.1,
};

// Idle decay never erases the relationship entirely — she drifts, she
// doesn't forget you. Only THIS decay path respects the floor; a bad scene
// or an aftercare debuff can still push below it (that's an earned cost,
// not idle drift).
const AFFECTION_NEGLECT_FLOOR = 15;
const SUBMISSION_NEGLECT_FLOOR = 10;

// Boredom accrual and Defiance cooldown are real-elapsed-time effects since
// the last completed round, same "regenerate on read" pattern as the energy
// pool (see games/energy.ts) — computed fresh each read, never persisted on
// a tick. Affection and Submission use the same elapsed-time input but only
// start moving once NEGLECT_GRACE_HOURS has passed, and only ever downward,
// floored so idle time alone can't zero out the bond — see the constants
// above for why gates/thresholds differ from Boredom/Defiance's.
export function applyTimeDecay(
  state: TraitState,
  character: CharacterDefinition,
  now: number = Date.now()
): TraitState {
  const elapsedHours = (now - state.lastActiveAt) / (1000 * 60 * 60);
  if (elapsedHours <= 0) return state;
  const rate = character.boredomRate;
  const neglectHours = Math.max(0, elapsedHours - NEGLECT_GRACE_HOURS);
  return {
    ...state,
    boredom: clamp(state.boredom + elapsedHours * BOREDOM_PER_HOUR[rate]),
    defiance: clamp(state.defiance - elapsedHours * DEFIANCE_COOLDOWN_PER_HOUR[rate]),
    affection:
      neglectHours > 0
        ? clamp(Math.max(AFFECTION_NEGLECT_FLOOR, state.affection - neglectHours * AFFECTION_DECAY_PER_HOUR[rate]))
        : state.affection,
    submission:
      neglectHours > 0
        ? clamp(Math.max(SUBMISSION_NEGLECT_FLOOR, state.submission - neglectHours * SUBMISSION_DECAY_PER_HOUR[rate]))
        : state.submission,
  };
}

// Minimum gap worth telling the player about — anything shorter is just
// "closed the tab and came back," not a real return-after-absence moment.
const IDLE_RECAP_MIN_HOURS = 6;

export type IdleRecapDeltas = {
  boredom: number;
  defiance: number;
  affection: number;
  submission: number;
};

export type IdleRecap = {
  elapsedHours: number;
  deltas: IdleRecapDeltas;
};

// Compares the raw (pre-decay) stored state against what applyTimeDecay
// produces for `now`, so the UI can show "while you were away" as a diff
// instead of the player having to infer it from two absolute numbers. Takes
// the raw snapshot as input (not a re-read) since storage.ts's loadTraits
// already discards it after decaying — see getIdleRecap there.
export function computeIdleRecap(
  raw: TraitState,
  character: CharacterDefinition,
  now: number = Date.now()
): IdleRecap | null {
  const elapsedHours = (now - raw.lastActiveAt) / (1000 * 60 * 60);
  if (elapsedHours < IDLE_RECAP_MIN_HOURS) return null;
  const decayed = applyTimeDecay(raw, character, now);
  const deltas: IdleRecapDeltas = {
    boredom: decayed.boredom - raw.boredom,
    defiance: decayed.defiance - raw.defiance,
    affection: decayed.affection - raw.affection,
    submission: decayed.submission - raw.submission,
  };
  const hasVisibleChange = Object.values(deltas).some((d) => Math.abs(d) >= 1);
  if (!hasVisibleChange) return null;
  return { elapsedHours, deltas };
}

// Per-implement "freshness" — a stamina pool per tool, same regen-on-read
// pattern as everything else here. Stored separately from TraitState
// (keyed by implement id) since it's per-tool, not per-character-axis.
export type FreshnessState = Record<string, { charge: number; lastUsedAt: number }>;

const FRESHNESS_MAX = 100;

export function decayFreshness(
  state: FreshnessState,
  implements_: Implement[],
  now: number = Date.now()
): FreshnessState {
  const next: FreshnessState = {};
  for (const impl of implements_) {
    const entry = state[impl.id];
    if (!entry) continue;
    const elapsedHours = (now - entry.lastUsedAt) / (1000 * 60 * 60);
    const recovered = elapsedHours > 0 ? elapsedHours * impl.freshnessRegenPerHour : 0;
    next[impl.id] = { charge: Math.min(FRESHNESS_MAX, entry.charge + recovered), lastUsedAt: entry.lastUsedAt };
  }
  return next;
}

export function spendFreshness(state: FreshnessState, implement: Implement, now: number = Date.now()): FreshnessState {
  const current = state[implement.id]?.charge ?? FRESHNESS_MAX;
  return { ...state, [implement.id]: { charge: Math.max(0, current - implement.freshnessCost), lastUsedAt: now } };
}

// Never-used implements read as fully fresh.
export function freshnessCharge(state: FreshnessState, implementId: string): number {
  return state[implementId]?.charge ?? FRESHNESS_MAX;
}

// Below this the multiplier stops shrinking — even the most overused
// implement still does *something*, it just stops being the exciting choice.
const FRESHNESS_FLOOR_MULTIPLIER = 0.5;

function freshnessMultiplier(charge: number): number {
  return Math.max(FRESHNESS_FLOOR_MULTIPLIER, charge / FRESHNESS_MAX);
}

// Driven by the implement's own tier, not just pace — a "gentle" implement
// used at a leisurely pace should never quietly satisfy a high-tolerance
// character just because pace alone didn't cross the intense threshold.
// Pace can only push a round UP to intense, never down below the
// implement's own floor.
export function classifyIntensity(implement: Implement, averagePace: number): RoundIntensity {
  if (averagePace >= 2.5) return "intense";
  return implement.intensityTier;
}

export function matchesTolerance(
  character: CharacterDefinition,
  intensity: RoundIntensity
): boolean {
  if (character.intensityTolerance === "low") return intensity !== "intense";
  return intensity !== "gentle";
}

// Once boredom crosses this line, a token/gentle effort no longer counts —
// "she's not impressed by half-hearted effort after being ignored."
const BOREDOM_DEMAND_THRESHOLD = 50;

export function meetsBoredomDemand(state: TraitState, intensity: RoundIntensity): boolean {
  if (state.boredom < BOREDOM_DEMAND_THRESHOLD) return true;
  return intensity !== "gentle";
}

export type RoundOutcome = {
  implement: Implement;
  intensity: RoundIntensity;
  matchesTolerance: boolean;
  metBoredomDemand: boolean;
  resonant: boolean; // implement is in the character's preferredImplementIds
  freshnessCharge: number; // 0..100, this implement's charge BEFORE this round's spend
  // Карт-бланш active this round — see characters/override.ts. Callers force
  // matchesTolerance/metBoredomDemand to true and freshnessCharge to 100
  // upstream; this flag additionally suppresses Submission gain (compliance
  // extracted through a pre-negotiated no-limits pass still isn't earned
  // trust) and the "too intense too soon" Affection penalty (she agreed to
  // this in advance, so it doesn't read as overreach).
  overriding: boolean;
  // Aftercare recovery window active — halves positive gains, doesn't touch
  // penalties. See applyAftercareDebuff/applyAftercareRelief below.
  recovering: boolean;
  // Whole-round aggregate from games/sessionQuality.ts (implement variety +
  // tolerance fit across every tap, not just the finishing implement) — a
  // flat bonus/penalty layered on top of the per-implement vector math
  // below, since "played this round well/badly overall" is a genuinely
  // separate signal from "which single implement did she get hit with."
  sessionQuality: SessionQuality;
};

// Mismatched tolerance guts Pleasure/Boredom-relief and amplifies
// Defiance-risk — a rough scene that doesn't fit the character isn't just
// "less good," it actively costs more than it gives.
const TOLERANCE_MISMATCH_MULTIPLIER = 0.4;
const DEFIANCE_MISMATCH_MULTIPLIER = 1.5;
// A predmet from the character's own preferred list lands harder across
// the board — this is the (previously unused) preferredImplementIds hook.
const RESONANCE_MULTIPLIER = 1.3;
// She's still processing — growth continues during recovery, just slower.
const RECOVERY_GAIN_MULTIPLIER = 0.5;

// Layered on top of the per-implement vector math, not scaled by it — a
// masterful round (varied, well-matched implements throughout) earns a
// flat bonus regardless of which implement happened to land the finishing
// hit; a clumsy one (spammed/mismatched/blocked taps) costs a flat penalty
// the same way. Sized to roughly one implement-vector's worth of effect
// (see games/registry.ts's per-implement `vector` values) so it reads as
// "how you played," comparable in weight to "what you played with."
const MASTERFUL_BONUS = { pleasure: 3, affection: 2, boredomRelief: 4 };
const CLUMSY_PENALTY = { defiance: 3, boredom: 4 };

export function applyRoundOutcome(state: TraitState, outcome: RoundOutcome): TraitState {
  const {
    implement,
    intensity,
    matchesTolerance: matched,
    metBoredomDemand: met,
    resonant,
    freshnessCharge: charge,
    overriding,
    recovering,
    sessionQuality,
  } = outcome;
  const { vector } = implement;

  const toleranceMult = matched ? 1 : TOLERANCE_MISMATCH_MULTIPLIER;
  const resonanceMult = resonant ? RESONANCE_MULTIPLIER : 1;
  const freshnessMult = freshnessMultiplier(charge);
  const recoveryMult = recovering ? RECOVERY_GAIN_MULTIPLIER : 1;

  // High Defiance dampens Submission gains — compliance under duress isn't
  // real trust, so it shouldn't count as much toward it. Mismatched rounds
  // still build some trust, just at half the implement's usual rate. Under
  // Карт-бланш it doesn't build any — see the RoundOutcome comment above.
  const defianceDamping = 1 - state.defiance / 100;
  const submissionGain = overriding
    ? 0
    : vector.submission * defianceDamping * (matched ? 1 : 0.5) * recoveryMult;

  // Pleasure and Boredom-relief share the same multipliers — tolerance fit,
  // resonance with her preferences, how fresh this specific implement
  // currently is, and whether she's still in an aftercare recovery window.
  let pleasureDelta = vector.pleasure * toleranceMult * resonanceMult * freshnessMult * recoveryMult;
  const boredomRelief = vector.boredomRelief * toleranceMult * resonanceMult * freshnessMult * recoveryMult;
  // Meeting a boredom-raised bar makes the relief count for more; missing it
  // means even a technically-fitting round barely registers.
  let boredomDelta = -boredomRelief * (met ? 1.4 : 0.4);

  // Defiance-risk is the implement's own baseline "how testing is this,"
  // scaled by whether it actually fit — a mismatched round amplifies it,
  // a genuinely good round (matched AND met) still cools her down a little
  // regardless of which implement was used. Under Карт-бланш matched/met are
  // forced true upstream, so this always lands on the calm branch — no
  // visible pushback during the pass, the cost shows up as aftercare after.
  let defianceDelta = !matched
    ? vector.defianceRisk * DEFIANCE_MISMATCH_MULTIPLIER
    : !met
      ? vector.defianceRisk * 0.6 + 1
      : -3;

  // Affection tracks gentleness relative to how much trust has actually
  // been earned: intensity a well-established Submission can support is
  // fine, the same intensity before that trust exists costs Affection
  // regardless of how "nice" the implement's own affection axis is. A
  // pre-negotiated Карт-бланш round is exempt from the overreach read — she
  // agreed to this in advance, it isn't a surprise.
  let affectionDelta = vector.affection * resonanceMult;
  if (intensity === "intense" && state.submission < 40 && !overriding) affectionDelta -= 6;
  else if (!matched) affectionDelta -= 2;
  if (affectionDelta > 0) affectionDelta *= recoveryMult;

  // Session-quality layer — masterful gains are gains, so they're dampened
  // by the same recovery window as everything else; clumsy's cost lands at
  // full strength regardless, same as every other penalty in this function.
  if (sessionQuality === "masterful") {
    pleasureDelta += MASTERFUL_BONUS.pleasure * recoveryMult;
    affectionDelta += MASTERFUL_BONUS.affection * recoveryMult;
    boredomDelta -= MASTERFUL_BONUS.boredomRelief * recoveryMult;
  } else if (sessionQuality === "clumsy") {
    defianceDelta += CLUMSY_PENALTY.defiance;
    boredomDelta += CLUMSY_PENALTY.boredom;
  }

  return {
    submission: clamp(state.submission + submissionGain),
    pleasure: clamp(state.pleasure + pleasureDelta),
    boredom: clamp(state.boredom + boredomDelta),
    defiance: clamp(state.defiance + defianceDelta),
    affection: clamp(state.affection + affectionDelta),
    lastActiveAt: Date.now(),
  };
}

// Lump consequence applied once a Карт-бланш pass runs out (see
// characters/override.ts) — framed as her needing aftercare after an
// intense, pre-negotiated no-limits scene, not as a punishment for the
// player. Submission is deliberately untouched: it was already excluded
// from gains during the pass, so there's nothing "earned" to claw back.
const AFTERCARE_DEBUFF = { boredom: 30, defiance: 25, affection: -18 };
// What buying "Забота" (Aftercare, see override.ts) instantly reverses —
// a fixed partial correction, not a full undo, so the pass still costs
// something even if the player pays to recover faster.
const AFTERCARE_RELIEF = { boredom: -15, defiance: -13, affection: 9 };

// `escalation` scales the whole debuff up — see override.ts's
// escalationMultiplier: buying another Карт-бланш while she's still mid
// recovery from the last one compounds the cost instead of resetting it.
export function applyAftercareDebuff(state: TraitState, escalation: number = 1): TraitState {
  return {
    ...state,
    boredom: clamp(state.boredom + AFTERCARE_DEBUFF.boredom * escalation),
    defiance: clamp(state.defiance + AFTERCARE_DEBUFF.defiance * escalation),
    affection: clamp(state.affection + AFTERCARE_DEBUFF.affection * escalation),
    lastActiveAt: Date.now(),
  };
}

export function applyAftercareRelief(state: TraitState): TraitState {
  return {
    ...state,
    boredom: clamp(state.boredom + AFTERCARE_RELIEF.boredom),
    defiance: clamp(state.defiance + AFTERCARE_RELIEF.defiance),
    affection: clamp(state.affection + AFTERCARE_RELIEF.affection),
    lastActiveAt: Date.now(),
  };
}

export type ImplementBlockReason = "defiance" | "submission" | "boredom";

export const IMPLEMENT_BLOCK_MESSAGES: Record<ImplementBlockReason, string> = {
  defiance: "Недоступно — слишком высокая дерзость",
  submission: "Недоступно — доверие ещё не заслужено",
  boredom: "Недоступно — ей нужно что-то серьёзнее",
};

// Blocks are temporary, not permanent — each resolves as the underlying
// trait drifts back through patient (or better-matched) play.
export function implementBlockReason(
  state: TraitState,
  character: CharacterDefinition,
  implement: Implement,
  overriding: boolean = false
): ImplementBlockReason | null {
  // Карт-бланш lifts every gate — that's the entire point of buying it.
  if (overriding) return null;

  // Open defiance — she won't engage with anything but the basics. Hand
  // stays exempt HERE specifically, so there's always one fallback move —
  // it must NOT be exempt from the boredom gate below, which exists
  // precisely to let her refuse "just the basics".
  if (state.defiance > 70 && implement.id !== "hand") return "defiance";

  // Low-tolerance character, trust not yet earned — the harshest tier is
  // gated until Submission proves it'll land as intended, not as overreach.
  if (character.intensityTolerance === "low" && implement.unlock === "purchase" && state.submission < 25) {
    return "submission";
  }

  // High-tolerance character, badly bored — she stops pretending the
  // free-tier basics (hand included) are enough once boredom has crossed
  // the hard line.
  if (character.intensityTolerance === "high" && implement.unlock === "free" && state.boredom >= 70) {
    return "boredom";
  }

  return null;
}

export function isImplementBlocked(
  state: TraitState,
  character: CharacterDefinition,
  implement: Implement,
  overriding: boolean = false
): boolean {
  return implementBlockReason(state, character, implement, overriding) !== null;
}

type StatusTier = { min: number; text: string };

// Affection-only ladder, checked after the Boredom/Defiance urgency branches
// below. Affection now does drift down on real neglect (see
// AFFECTION_DECAY_PER_HOUR in applyTimeDecay above), but only past a
// multi-day grace window and floored well above zero — so this ladder still
// mostly reads as "how far the bond has come," with the Boredom branch
// covering the sharper, faster "you just haven't visited in a while" read.
// Tiers ordered high→low; first match wins. Written in each
// character's own voice rather than one shared wording — see traitNotes for
// why that matters here too.
const AFFECTION_STATUS_LADDER: Record<string, StatusTier[]> = {
  rin: [
    { min: 90, text: "Рин — с вами настоящая, без остатка прежнего страха." },
    { min: 75, text: "Рин признаётся, что думает о вас чаще, чем следовало бы для «просто попробовать»." },
    { min: 55, text: "Рин доверяет вам больше, чем сама от себя ожидала." },
    { min: 35, text: "Рин понемногу расслабляется рядом с вами — и перестаёт извиняться за то, чего хочет." },
    { min: 15, text: "Рин ещё присматривается, не решаясь довериться до конца." },
    { min: -Infinity, text: "Рин будто снова не уверена, стоило ли писать вам первой." },
  ],
  ada: [
    { min: 85, text: "Ада — без брони, и явно не планирует надевать её обратно." },
    { min: 70, text: "Ада вычеркнула вас из своих «критериев» — там больше нечего отмечать." },
    { min: 50, text: "Ада всё ещё проверяет вас — но уже не потому, что ждёт разочарования." },
    { min: 30, text: "Ада перестала сверяться с ежедневником при каждой встрече — чуть-чуть, но перестала." },
    { min: 10, text: "Ада держит дистанцию — обычная стартовая позиция, ничего личного." },
    { min: -Infinity, text: "Ада держит дистанцию — вы пока даже не в её списке." },
  ],
};

// Below this, low Affection alone reads as "cold" even without active
// Defiance/Boredom — a snapshot used by resolveStoryVariant (games/stories.ts)
// to pick between genuinely different finale texts, not just relationshipStatusLine's copy.
const COLD_AFFECTION_FLOOR = 20;

export function moodTag(traits: TraitState): "warm" | "cold" {
  if (traits.defiance > 60 || traits.boredom > 60) return "cold";
  if (traits.affection < COLD_AFFECTION_FLOOR) return "cold";
  return "warm";
}

export function relationshipStatusLine(
  traits: TraitState,
  character: CharacterDefinition
): string {
  if (traits.defiance > 60) return `${character.name} сейчас дерзит — не время форсировать.`;
  if (traits.boredom > 60) return `${character.name} заскучала — стоит зайти и удивить её.`;

  const ladder = AFFECTION_STATUS_LADDER[character.id];
  const tier = ladder?.find((t) => traits.affection >= t.min);
  if (tier) return tier.text;

  // Fallback for any character without a defined ladder above.
  if (traits.affection > 70 && traits.submission > 60) return `${character.name} вам искренне доверяет.`;
  if (traits.affection < 20) return `${character.name} держит дистанцию.`;
  return `${character.name} присматривается к вам.`;
}
