import { getCharacterForGame } from "./registry";
import { getImplement } from "../games/registry";
import type { SessionQuality } from "../games/sessionQuality";
import { escalationMultiplier, isOverrideActive, isRecovering, recoveryHoursFor } from "./override";
import { loadFreshness, loadOverride, loadTraits, saveFreshness, saveOverride, saveTraits } from "./storage";
import {
  applyAftercareDebuff,
  applyRoundOutcome,
  classifyIntensity,
  freshnessCharge,
  matchesTolerance,
  meetsBoredomDemand,
  spendFreshness,
} from "./traits";

// Single entry point both game engines call at round completion — keeps
// SpankGame/SpankGameRate from needing to know about trait internals, and
// keeps the classify -> outcome -> save sequence in one place.
export function applyRoundToCharacter(
  address: string,
  gameId: string,
  implementId: string,
  averagePace: number,
  sessionQuality: SessionQuality
): void {
  const character = getCharacterForGame(gameId);
  const implement = getImplement(implementId);
  if (!character || !implement) return;

  const traits = loadTraits(address, character);
  const freshness = loadFreshness(address, character);
  const override = loadOverride(address, character.id);

  const overriding = isOverrideActive(override);
  // Recovery gains apply only once the pass itself has ended, never during
  // the pass's own final round.
  const recovering = !overriding && isRecovering(override);
  const intensity = classifyIntensity(implement, averagePace);

  const outcome = {
    implement,
    intensity,
    matchesTolerance: overriding ? true : matchesTolerance(character, intensity),
    metBoredomDemand: overriding ? true : meetsBoredomDemand(traits, intensity),
    resonant: character.preferredImplementIds.includes(implement.id),
    // Карт-бланш ignores wear for the multiplier, but the implement still
    // physically gets spent below — it'll show worn once the pass ends.
    freshnessCharge: overriding ? 100 : freshnessCharge(freshness, implement.id),
    overriding,
    recovering,
    sessionQuality,
  };

  let next = applyRoundOutcome(traits, outcome);
  saveFreshness(address, character.id, spendFreshness(freshness, implement));

  if (overriding) {
    const roundsRemaining = override.roundsRemaining - 1;
    if (roundsRemaining <= 0) {
      const escalation = escalationMultiplier(override.chainCount);
      next = applyAftercareDebuff(next, escalation);
      saveOverride(address, character.id, {
        roundsRemaining: 0,
        recoveryUntil: Date.now() + recoveryHoursFor(character) * escalation * 60 * 60 * 1000,
        chainCount: override.chainCount,
      });
    } else {
      saveOverride(address, character.id, { ...override, roundsRemaining });
    }
  }

  saveTraits(address, character.id, next);
}
