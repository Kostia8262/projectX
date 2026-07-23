import type { CharacterDefinition } from "./registry";
import type { Implement, RoundIntensity } from "../games/registry";

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

export function createInitialTraits(): TraitState {
  return {
    submission: 15,
    pleasure: 15,
    boredom: 0,
    defiance: 10,
    affection: 15,
    lastActiveAt: Date.now(),
  };
}

const BOREDOM_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 4,
  slow: 1.5,
};

// Defiance cools off passively too — reuses the same fast/slow axis as
// Boredom (a character who gets bored quickly also forgives quickly; a
// character who stays interested longer also holds a grudge longer).
const DEFIANCE_COOLDOWN_PER_HOUR: Record<CharacterDefinition["boredomRate"], number> = {
  fast: 2,
  slow: 1,
};

// Both Boredom accrual and Defiance cooldown are real-elapsed-time effects
// since the last completed round — same "regenerate on read" pattern as the
// energy pool (see games/energy.ts), just computed fresh each read instead
// of persisted on a tick.
export function applyTimeDecay(
  state: TraitState,
  character: CharacterDefinition,
  now: number = Date.now()
): TraitState {
  const elapsedHours = (now - state.lastActiveAt) / (1000 * 60 * 60);
  if (elapsedHours <= 0) return state;
  return {
    ...state,
    boredom: clamp(state.boredom + elapsedHours * BOREDOM_PER_HOUR[character.boredomRate]),
    defiance: clamp(state.defiance - elapsedHours * DEFIANCE_COOLDOWN_PER_HOUR[character.boredomRate]),
  };
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
  const pleasureDelta = vector.pleasure * toleranceMult * resonanceMult * freshnessMult * recoveryMult;
  const boredomRelief = vector.boredomRelief * toleranceMult * resonanceMult * freshnessMult * recoveryMult;
  // Meeting a boredom-raised bar makes the relief count for more; missing it
  // means even a technically-fitting round barely registers.
  const boredomDelta = -boredomRelief * (met ? 1.4 : 0.4);

  // Defiance-risk is the implement's own baseline "how testing is this,"
  // scaled by whether it actually fit — a mismatched round amplifies it,
  // a genuinely good round (matched AND met) still cools her down a little
  // regardless of which implement was used. Under Карт-бланш matched/met are
  // forced true upstream, so this always lands on the calm branch — no
  // visible pushback during the pass, the cost shows up as aftercare after.
  const defianceDelta = !matched
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

export function applyAftercareDebuff(state: TraitState): TraitState {
  return {
    ...state,
    boredom: clamp(state.boredom + AFTERCARE_DEBUFF.boredom),
    defiance: clamp(state.defiance + AFTERCARE_DEBUFF.defiance),
    affection: clamp(state.affection + AFTERCARE_DEBUFF.affection),
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

// Blocks are temporary, not permanent — each resolves as the underlying
// trait drifts back through patient (or better-matched) play. "hand" is
// always exempt: there must always be one safe fallback move available.
export function isImplementBlocked(
  state: TraitState,
  character: CharacterDefinition,
  implement: Implement,
  overriding: boolean = false
): boolean {
  // Карт-бланш lifts every gate — that's the entire point of buying it.
  if (overriding) return false;
  if (implement.id === "hand") return false;

  // Open defiance — she won't engage with anything but the basics.
  if (state.defiance > 70) return true;

  // Low-tolerance character, trust not yet earned — the harshest tier is
  // gated until Submission proves it'll land as intended, not as overreach.
  if (character.intensityTolerance === "low" && implement.unlock === "purchase" && state.submission < 25) {
    return true;
  }

  // High-tolerance character, badly bored — she stops pretending the
  // free-tier basics are enough once boredom has crossed the hard line.
  if (character.intensityTolerance === "high" && implement.unlock === "free" && state.boredom >= 70) {
    return true;
  }

  return false;
}

export function relationshipStatusLine(
  traits: TraitState,
  character: CharacterDefinition
): string {
  if (traits.defiance > 60) return `${character.name} сейчас дерзит — не время форсировать.`;
  if (traits.boredom > 60) return `${character.name} заскучала — стоит зайти и удивить её.`;
  if (traits.affection > 70 && traits.submission > 60) return `${character.name} вам искренне доверяет.`;
  if (traits.affection < 20) return `${character.name} держит дистанцию.`;
  return `${character.name} присматривается к вам.`;
}
