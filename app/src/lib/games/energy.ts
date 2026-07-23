// Strategy A (energy/stamina): actions cost energy, energy regenerates over
// time, running out is the natural stopping point that a refill purchase
// (placeholder for now) or a subscription-tier bonus (not wired yet — see
// memory) can remove.
//
// Cap was 30 with +1/2min (60 min to fill from empty); bumped to 100 and
// retuned to +1/min so a full refill takes ~100 min — longer sessions
// before hitting the wall, without stretching the "come back later" loop
// out to multiple hours the way holding the old per-point rate would have.
export const ENERGY_MAX = 100;
export const ENERGY_REGEN_MS = 60 * 1000; // +1 every minute

export type EnergyState = {
  current: number;
  lastUpdate: number;
};

export function createInitialEnergy(): EnergyState {
  return { current: ENERGY_MAX, lastUpdate: Date.now() };
}

export function regenEnergy(state: EnergyState, now: number = Date.now()): EnergyState {
  if (state.current >= ENERGY_MAX) return state;
  const elapsed = now - state.lastUpdate;
  const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
  if (gained <= 0) return state;
  return {
    current: Math.min(ENERGY_MAX, state.current + gained),
    lastUpdate: state.lastUpdate + gained * ENERGY_REGEN_MS,
  };
}

export function refillEnergy(): EnergyState {
  return createInitialEnergy();
}
