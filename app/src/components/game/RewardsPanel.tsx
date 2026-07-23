"use client";

import { useState } from "react";
import { REWARDS } from "@/lib/rewards/registry";
import { useSharedAffinity } from "@/hooks/useSharedAffinity";

type RevealState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "shown"; url: string };

export function RewardsPanel({ address }: { address: string }) {
  const { affinity } = useSharedAffinity(address);
  const [reveals, setReveals] = useState<Record<string, RevealState>>({});

  async function reveal(rewardId: string) {
    setReveals((r) => ({ ...r, [rewardId]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/rewards/${rewardId}/access`);
      const data = await res.json();
      if (!res.ok) {
        setReveals((r) => ({
          ...r,
          [rewardId]: { status: "error", message: data.error ?? "Не удалось открыть" },
        }));
        return;
      }
      setReveals((r) => ({ ...r, [rewardId]: { status: "shown", url: data.url } }));
    } catch {
      setReveals((r) => ({
        ...r,
        [rewardId]: { status: "error", message: "Сеть недоступна" },
      }));
    }
  }

  const maxThreshold = Math.max(...REWARDS.map((r) => r.threshold));
  const fillPercent = Math.min(100, (affinity / maxThreshold) * 100);
  const nextReward = REWARDS.find((r) => affinity < r.threshold);

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">Прогресс отклика</p>
          <p className="text-sm font-semibold tabular-nums text-fuchsia-300">
            {Math.floor(affinity)}
            {nextReward && (
              <span className="ml-1 font-normal text-neutral-500">/ {nextReward.threshold}</span>
            )}
          </p>
        </div>

        <div className="relative mt-4 mb-2 h-2.5 w-full overflow-visible rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${fillPercent}%` }}
          />
          {REWARDS.map((reward) => {
            const pos = Math.min(100, (reward.threshold / maxThreshold) * 100);
            const reached = affinity >= reward.threshold;
            return (
              <div
                key={reward.id}
                className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 ${
                  reached ? "border-white bg-fuchsia-400" : "border-white/30 bg-neutral-800"
                }`}
                style={{ left: `${pos}%` }}
                title={`${reward.title} — ${reward.threshold}`}
              />
            );
          })}
        </div>
        {nextReward ? (
          <p className="mb-2 text-[11px] text-neutral-500">
            До «{nextReward.title}»: {Math.max(0, nextReward.threshold - Math.floor(affinity))}
          </p>
        ) : (
          <p className="mb-2 text-[11px] text-emerald-400">Все пороги пройдены</p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REWARDS.map((reward) => {
            const unlocked = affinity >= reward.threshold;
            const state = reveals[reward.id] ?? { status: "idle" };

            return (
              <div
                key={reward.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center"
              >
                {state.status === "shown" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.url}
                    alt={reward.title}
                    className="h-32 w-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-24 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 text-2xl">
                    {unlocked ? "🔓" : "🔒"}
                  </div>
                )}
                <p className="text-xs font-medium text-white">{reward.title}</p>
                {state.status === "shown" ? (
                  <p className="text-[11px] text-emerald-400">Открыто</p>
                ) : unlocked ? (
                  <button
                    onClick={() => reveal(reward.id)}
                    disabled={state.status === "loading"}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {state.status === "loading" ? "…" : "Открыть"}
                  </button>
                ) : (
                  <p className="text-[11px] text-neutral-500">нужно {reward.threshold}</p>
                )}
                {state.status === "error" && (
                  <p className="text-[11px] text-red-400">{state.message}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
