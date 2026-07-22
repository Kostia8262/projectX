import type { CharacterDefinition } from "./registry";
import { createInitialTraits, decayBoredom, type TraitState } from "./traits";

function traitsKey(address: string, characterId: string): string {
  return `kink-traits-${characterId}-${address.toLowerCase()}`;
}

export function loadTraits(address: string, character: CharacterDefinition): TraitState {
  if (typeof window === "undefined") return createInitialTraits();
  const raw = window.localStorage.getItem(traitsKey(address, character.id));
  const base: TraitState = raw ? JSON.parse(raw) : createInitialTraits();
  return decayBoredom(base, character);
}

export function saveTraits(address: string, characterId: string, state: TraitState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(traitsKey(address, characterId), JSON.stringify(state));
}
