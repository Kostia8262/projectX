import type { CharacterDefinition } from "./registry";
import type { OverrideState } from "./override";
import { IMPLEMENTS } from "../games/registry";
import { applyTimeDecay, createInitialTraits, decayFreshness, type FreshnessState, type TraitState } from "./traits";

function traitsKey(address: string, characterId: string): string {
  return `kink-traits-${characterId}-${address.toLowerCase()}`;
}

function freshnessKey(address: string, characterId: string): string {
  return `kink-freshness-${characterId}-${address.toLowerCase()}`;
}

function overrideKey(address: string, characterId: string): string {
  return `kink-override-${characterId}-${address.toLowerCase()}`;
}

export function loadTraits(address: string, character: CharacterDefinition): TraitState {
  if (typeof window === "undefined") return createInitialTraits();
  const raw = window.localStorage.getItem(traitsKey(address, character.id));
  const base: TraitState = raw ? JSON.parse(raw) : createInitialTraits();
  return applyTimeDecay(base, character);
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
