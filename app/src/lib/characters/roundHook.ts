import { getCharacterForGame } from "./registry";
import { loadTraits, saveTraits } from "./storage";
import {
  applyRoundOutcome,
  classifyIntensity,
  matchesTolerance,
  meetsBoredomDemand,
} from "./traits";

// Single entry point both game engines call at round completion — keeps
// SpankGame/SpankGameRate from needing to know about trait internals, and
// keeps the classify -> outcome -> save sequence in one place.
export function applyRoundToCharacter(
  address: string,
  gameId: string,
  implementId: string,
  averagePace: number
): void {
  const character = getCharacterForGame(gameId);
  if (!character) return;

  const traits = loadTraits(address, character);
  const intensity = classifyIntensity(implementId, averagePace);
  const outcome = {
    intensity,
    matchesTolerance: matchesTolerance(character, intensity),
    metBoredomDemand: meetsBoredomDemand(traits, intensity),
  };
  const next = applyRoundOutcome(traits, outcome);
  saveTraits(address, character.id, next);
}
