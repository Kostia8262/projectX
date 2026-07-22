// Strategy A (energy/stamina): actions cost energy, energy regenerates over
// time, running out is the natural stopping point that a refill purchase
// (placeholder for now) or a subscription-tier bonus (not wired yet — see
// memory) can remove.
export const ENERGY_MAX = 30;
export const ENERGY_REGEN_MS = 2 * 60 * 1000; // +1 every 2 minutes

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
