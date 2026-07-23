import type { CharacterDefinition } from "./registry";
import type { OverrideState } from "./override";
import { IMPLEMENTS } from "../games/registry";
import {
  applyTimeDecay,
  computeIdleRecap,
  createInitialTraits,
  decayFreshness,
  type FreshnessState,
  type IdleRecap,
  type TraitState,
} from "./traits";

function traitsKey(address: string, characterId: string): string {
  return `kink-traits-${characterId}-${address.toLowerCase()}`;
}

function freshnessKey(address: string, characterId: string): string {
  return `kink-freshness-${characterId}-${address.toLowerCase()}`;
}

function overrideKey(address: string, characterId: string): string {
  return `kink-override-${characterId}-${address.toLowerCase()}`;
}

// Pre-decay snapshot exactly as persisted — the only consumer today is
// getIdleRecap below, which needs the undecayed values to diff against.
// Everything else should keep calling loadTraits.
function loadRawTraits(address: string, character: CharacterDefinition): TraitState {
  if (typeof window === "undefined") return createInitialTraits(character);
  const raw = window.localStorage.getItem(traitsKey(address, character.id));
  return raw ? JSON.parse(raw) : createInitialTraits(character);
}

export function loadTraits(address: string, character: CharacterDefinition): TraitState {
  return applyTimeDecay(loadRawTraits(address, character), character);
}

// "While you were away" diff for the CharacterPage banner — null when there's
// nothing worth telling the player (just opened the app, or the gap was too
// short to move anything a visible amount). See computeIdleRecap for the
// actual math; this just supplies the raw pre-decay snapshot it needs.
export function getIdleRecap(address: string, character: CharacterDefinition): IdleRecap | null {
  if (typeof window === "undefined") return null;
  return computeIdleRecap(loadRawTraits(address, character), character);
}

export function saveTraits(address: string, characterId: string, state: TraitState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(traitsKey(address, characterId), JSON.stringify(state));
}

export function loadFreshness(address: string, character: CharacterDefinition): FreshnessState {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(freshnessKey(address, character.id));
  const base: FreshnessState = raw ? JSON.parse(raw) : {};
  return decayFreshness(base, IMPLEMENTS);
}

export function saveFreshness(address: string, characterId: string, state: FreshnessState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(freshnessKey(address, characterId), JSON.stringify(state));
}

const NO_OVERRIDE: OverrideState = { roundsRemaining: 0, recoveryUntil: null, chainCount: 0 };

export function loadOverride(address: string, characterId: string): OverrideState {
  if (typeof window === "undefined") return NO_OVERRIDE;
  const raw = window.localStorage.getItem(overrideKey(address, characterId));
  // Spread over the default so a record saved before `chainCount` existed
  // still loads with a sane value instead of undefined.
  return raw ? { ...NO_OVERRIDE, ...JSON.parse(raw) } : NO_OVERRIDE;
}

export function saveOverride(address: string, characterId: string, state: OverrideState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(overrideKey(address, characterId), JSON.stringify(state));
}
