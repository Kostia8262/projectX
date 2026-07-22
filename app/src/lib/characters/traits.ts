import type { CharacterDefinition } from "./registry";

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

// Boredom accrues in real elapsed time since the last completed round —
// same "regenerate on read" pattern as the energy pool, just growing
// instead of refilling.
export function decayBoredom(
  state: TraitState,
  character: CharacterDefinition,
  now: number = Date.now()
): TraitState {
  const elapsedHours = (now - state.lastActiveAt) / (1000 * 60 * 60);
  if (elapsedHours <= 0) return state;
  const rate = BOREDOM_PER_HOUR[character.boredomRate];
  return { ...state, boredom: clamp(state.boredom + elapsedHours * rate) };
}

export type RoundIntensity = "gentle" | "moderate" | "intense";

export function classifyIntensity(implementId: string, averagePace: number): RoundIntensity {
  if (implementId === "flogger" || averagePace >= 2.5) return "intense";
  if (implementId === "hand" && averagePace < 1) return "gentle";
  return "moderate";
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
  intensity: RoundIntensity;
  matchesTolerance: boolean;
  metBoredomDemand: boolean;
};

export function applyRoundOutcome(state: TraitState, outcome: RoundOutcome): TraitState {
  const { intensity, matchesTolerance: matched, metBoredomDemand: met } = outcome;

  // High Defiance dampens Submission gains — compliance under duress isn't
  // real trust, so it shouldn't count as much toward it.
  const defianceDamping = 1 - state.defiance / 100;
  const submissionGain = (matched ? 6 : 2) * defianceDamping;

  // Pleasure tracks fit with THIS character's tolerance, not raw intensity —
  // the same rough round that suits Ада can read as a mismatch for Рин.
  const pleasureDelta = matched ? 5 : -4;

  // Meeting a boredom-raised bar resets it hard; under-delivering while
  // she's already bored barely dents it.
  const boredomDelta = met ? -35 : -8;

  // Defiance rises from a tolerance mismatch, or from under-delivering
  // once she's already bored — not just from low stats in general.
  const defianceDelta = !matched ? 5 : !met ? 3 : -3;

  // Affection tracks gentleness relative to how much trust has actually
  // been earned: intensity a well-established Submission can support is
  // fine, the same intensity before that trust exists costs Affection.
  const affectionDelta =
    intensity === "intense" && state.submission < 40 ? -6 : matched ? 4 : -2;

  return {
    submission: clamp(state.submission + submissionGain),
    pleasure: clamp(state.pleasure + pleasureDelta),
    boredom: clamp(state.boredom + boredomDelta),
    defiance: clamp(state.defiance + defianceDelta),
    affection: clamp(state.affection + affectionDelta),
    lastActiveAt: Date.now(),
  };
}

// Blocks a specific implement while Defiance is high — temporary, not
// permanent, resolves as Defiance decays back down through patient play.
export function isImplementBlocked(state: TraitState, implementId: string): boolean {
  return state.defiance > 70 && implementId !== "hand";
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
