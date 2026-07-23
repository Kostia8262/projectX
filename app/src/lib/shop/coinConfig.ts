// Shared by the server-side indexer and the client-side top-up UI, and
// mirrored on-chain by CoinTopUp.sol's `packagePrices` (see
// contracts/ignition/modules/CoinTopUpLocal.ts for the same numbers set at
// deploy time). Packages are discrete, not a free-form amount — see
// CoinTopUp.sol's top comment for why a continuous rate would make the bulk
// discount below gameable.
//
// Base rate is 100 coins per $1 (id 0, no discount). Bigger packages give a
// small, increasing bonus — the discount IS the extra coins, not a lower
// price: everyone pays the listed USDT price, bigger packages just grant
// more coins per dollar.
export type TopUpPackage = {
  id: number;
  coins: number;
  tokenAmount: string; // smallest units of a 6-decimal stablecoin, as a string — safe to ship to the client
  bonusPercent: number; // for display only — already baked into `coins`
};

export const TOPUP_PACKAGES: TopUpPackage[] = [
  { id: 0, coins: 300, tokenAmount: "3000000", bonusPercent: 0 },
  { id: 1, coins: 810, tokenAmount: "7500000", bonusPercent: 8 },
  { id: 2, coins: 1740, tokenAmount: "15000000", bonusPercent: 16 },
];

export function getTopUpPackage(id: number): TopUpPackage | undefined {
  return TOPUP_PACKAGES.find((p) => p.id === id);
}

// Energy is still the free, time-regenerating pacing resource (see
// games/energy.ts) — this doesn't replace that, it just gives coins a
// second use besides cosmetics: skip the wait instead of removing it.
// 100 coins == the base top-up rate's $1, so a full refill is roughly a
// dollar at list price.
export const ENERGY_REFILL_COST_COINS = 100;
