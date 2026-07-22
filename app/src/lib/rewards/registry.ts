// Reward scenes gated behind subscription + a single shared progress meter
// ("отклик") fed by every mini-game — not per-game silos. Placeholder images
// for now (generated on the fly); real media + real character comes in
// Phase 8/9. Deposit-size-based boosts are a later refinement — see memory.
export type RewardDefinition = {
  id: string;
  title: string;
  threshold: number;
  accentFrom: string;
  accentTo: string;
};

export const REWARDS: RewardDefinition[] = [
  { id: "reward-1", title: "Отклик I", threshold: 150, accentFrom: "#d946ef", accentTo: "#6366f1" },
  { id: "reward-2", title: "Отклик II", threshold: 600, accentFrom: "#f97316", accentTo: "#d946ef" },
  { id: "reward-3", title: "Отклик III", threshold: 1500, accentFrom: "#06b6d4", accentTo: "#6366f1" },
];

export function getReward(rewardId: string): RewardDefinition | undefined {
  return REWARDS.find((r) => r.id === rewardId);
}
