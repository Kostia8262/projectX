import type { CharacterDefinition, IntensityTolerance } from "./registry";
import { loadOverride, loadTraits, saveOverride, saveTraits } from "./storage";
import { applyAftercareRelief } from "./traits";

// Карт-бланш: a pre-negotiated "no limits" pass, not an absence of consent —
// she agrees up front to a few rounds without the usual gates, and pays for
// it in the aftercare debuff that follows (applyAftercareDebuff, fired from
// roundHook.ts when the pass runs out). Not sold in the shop — these are
// two small in-game icons (see OverrideControls.tsx), bought on impulse
// mid-session rather than browsed for.
export const CARTE_BLANCHE_ROUNDS = 3;
export const CARTE_BLANCHE_PRICE = 9; // USDT, placeholder — see accessories.ts
export const AFTERCARE_PRICE = 3.5;

const RECOVERY_HOURS: Record<IntensityTolerance, number> = {
  low: 8, // more overwhelmed by intensity, needs longer to come back
  high: 4, // thrives on intensity, bounces back faster
};

export type OverrideState = {
  roundsRemaining: number;
  recoveryUntil: number | null;
};

export function isOverrideActive(state: OverrideState): boolean {
  return state.roundsRemaining > 0;
}

export function isRecovering(state: OverrideState, now: number = Date.now()): boolean {
  return state.recoveryUntil !== null && now < state.recoveryUntil;
}

export function recoveryHoursFor(character: CharacterDefinition): number {
  return RECOVERY_HOURS[character.intensityTolerance];
}

export function buyCarteBlanche(address: string, character: CharacterDefinition): OverrideState {
  const state: OverrideState = { ...loadOverride(address, character.id), roundsRemaining: CARTE_BLANCHE_ROUNDS };
  saveOverride(address, character.id, state);
  return state;
}

export function buyAftercare(address: string, character: CharacterDefinition): OverrideState {
  saveTraits(address, character.id, applyAftercareRelief(loadTraits(address, character)));
  const state: OverrideState = { ...loadOverride(address, character.id), recoveryUntil: null };
  saveOverride(address, character.id, state);
  return state;
}
