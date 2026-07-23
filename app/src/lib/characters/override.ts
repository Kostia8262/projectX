import type { CharacterDefinition, IntensityTolerance } from "./registry";
import { loadOverride, loadTraits, saveOverride, saveTraits } from "./storage";
import { applyAftercareRelief } from "./traits";

// Карт-бланш: a pre-negotiated "no limits" pass, not an absence of consent —
// she agrees up front to a few rounds without the usual gates, and pays for
// it in the aftercare debuff that follows (applyAftercareDebuff, fired from
// roundHook.ts when the pass runs out). Not sold in the shop — these are
// two small in-game icons (see OverrideControls.tsx), bought on impulse
// mid-session rather than browsed for. Both charge real shop coins through
// /api/game/carte-blanche and /api/game/aftercare BEFORE any local state
// changes — same balance as accessories (see shop/store.ts), the debit is
// the source of truth, not a client-side toggle.
export const CARTE_BLANCHE_ROUNDS = 3;
export const CARTE_BLANCHE_PRICE = 9; // shop coins — see lib/shop/coinConfig.ts for the crypto conversion rate
export const AFTERCARE_PRICE = 3.5;

const RECOVERY_HOURS: Record<IntensityTolerance, number> = {
  low: 8, // more overwhelmed by intensity, needs longer to come back
  high: 4, // thrives on intensity, bounces back faster
};

// Buying another pass while she's still visibly recovering from the last
// one compounds instead of resetting — no free ceiling on how hard back-
// to-back scenes without real rest can hit. Capped so it stays a debuff,
// not a punishment spiral.
const ESCALATION_STEP = 0.3;
const MAX_ESCALATION_MULTIPLIER = 2.2;

export function escalationMultiplier(chainCount: number): number {
  return Math.min(MAX_ESCALATION_MULTIPLIER, 1 + chainCount * ESCALATION_STEP);
}

export type OverrideState = {
  roundsRemaining: number;
  recoveryUntil: number | null;
  // How many Карт-бланш passes in a row were bought while still mid-
  // recovery from the previous one. Resets to 0 on any pass bought AFTER
  // recovery has actually run out (or been paid off via Забота).
  chainCount: number;
};

export type OverridePurchaseResult =
  | { ok: true; state: OverrideState }
  | { ok: false; error: string; state: OverrideState };

export function isOverrideActive(state: OverrideState): boolean {
  return state.roundsRemaining > 0;
}

export function isRecovering(state: OverrideState, now: number = Date.now()): boolean {
  return state.recoveryUntil !== null && now < state.recoveryUntil;
}

export function recoveryHoursFor(character: CharacterDefinition): number {
  return RECOVERY_HOURS[character.intensityTolerance];
}

async function chargeCoins(
  endpoint: string,
  characterId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: typeof data?.error === "string" ? data.error : "Не удалось купить" };
}

export async function buyCarteBlanche(
  address: string,
  character: CharacterDefinition
): Promise<OverridePurchaseResult> {
  const charge = await chargeCoins("/api/game/carte-blanche", character.id);
  const current = loadOverride(address, character.id);
  if (!charge.ok) return { ok: false, error: charge.error, state: current };

  const chaining = isRecovering(current);
  const state: OverrideState = {
    roundsRemaining: CARTE_BLANCHE_ROUNDS,
    recoveryUntil: current.recoveryUntil,
    chainCount: chaining ? current.chainCount + 1 : 0,
  };
  saveOverride(address, character.id, state);
  return { ok: true, state };
}

export async function buyAftercare(
  address: string,
  character: CharacterDefinition
): Promise<OverridePurchaseResult> {
  const charge = await chargeCoins("/api/game/aftercare", character.id);
  const current = loadOverride(address, character.id);
  if (!charge.ok) return { ok: false, error: charge.error, state: current };

  saveTraits(address, character.id, applyAftercareRelief(loadTraits(address, character)));
  const state: OverrideState = { ...current, recoveryUntil: null, chainCount: 0 };
  saveOverride(address, character.id, state);
  return { ok: true, state };
}
