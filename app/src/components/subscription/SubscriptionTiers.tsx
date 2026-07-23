"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";
import { useFreePlan } from "@/lib/subscription/freePlan";
import { ERC20_APPROVE_ABI } from "@/lib/erc20Abi";
import { SUBSCRIBE_ABI } from "@/lib/subscription/subscribeAbi";

const SUBSCRIPTION_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}` | undefined;
const PAYMENT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS as
  | `0x${string}`
  | undefined;

type SubscriptionStatus = { active: boolean; tierId: number | null };

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch("/api/subscription/status");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить статус подписки");
  return data;
}

export function SubscriptionTiers() {
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const { isActivated: freeActivated, activate } = useFreePlan();
  const [pendingTierId, setPendingTierId] = useState<number | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const statusQuery = useQuery({ queryKey: ["subscription-status"], queryFn: fetchSubscriptionStatus });
  const activeTierId = statusQuery.data?.active ? statusQuery.data.tierId : null;
  const contractConfigured = Boolean(SUBSCRIPTION_CONTRACT_ADDRESS && PAYMENT_TOKEN_ADDRESS);

  function handleActivateFree() {
    activate.mutate();
  }

  async function handleSubscribe(tierId: number, priceTokenAmount: string) {
    if (!SUBSCRIPTION_CONTRACT_ADDRESS || !PAYMENT_TOKEN_ADDRESS) return;
    setSubscribeError(null);
    setPendingTierId(tierId);
    try {
      const amount = BigInt(priceTokenAmount);
      const approveHash = await writeContractAsync({
        address: PAYMENT_TOKEN_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [SUBSCRIPTION_CONTRACT_ADDRESS, amount],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      const subscribeHash = await writeContractAsync({
        address: SUBSCRIPTION_CONTRACT_ADDRESS,
        abi: SUBSCRIBE_ABI,
        functionName: "subscribe",
        args: [tierId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: subscribeHash });

      // The indexer picks up the payment the next time status is asked, not
      // the instant the tx lands — refetch a couple of times to ride out
      // that gap. Shop discount/exclusives depend on the tier too.
      await queryClient.invalidateQueries({ queryKey: ["subscription-status"] });
      await queryClient.invalidateQueries({ queryKey: ["shop-state"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subscription-status"] }), 3000);
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Не удалось оформить подписку");
    } finally {
      setPendingTierId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Подписка
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Четыре уровня доступа — от бесплатного знакомства до полного набора механик.
        </p>
        {!contractConfigured && (
          <p className="mt-1 text-xs text-amber-400/80">
            Оплата платных тарифов ещё не настроена (нет адреса контракта в конфигурации).
          </p>
        )}
        {subscribeError && <p className="mt-1 text-xs text-rose-400">{subscribeError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isActive = !tier.isFree && activeTierId === tier.contractTierId;
          const isPending = pendingTierId === tier.contractTierId;
          return (
            <div
              key={tier.id}
              className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xl shadow-black/30 backdrop-blur-2xl ${
                tier.highlighted
                  ? "border-fuchsia-400/40 bg-white/[0.09]"
                  : tier.isFree
                    ? "border-emerald-400/30 bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.06]"
              }`}
            >
              {tier.highlighted && (
                <span className="w-fit rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
                  Популярный
                </span>
              )}
              {tier.isFree && (
                <span className="w-fit rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Без оплаты
                </span>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
                  {tier.tagline}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">{tier.name}</h2>
                <p className="mt-1 text-2xl font-bold text-white">{tier.priceLabel}</p>
              </div>
              <ul className="flex-1 space-y-2 text-sm text-neutral-300">
                {tier.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              {tier.isFree ? (
                <button
                  onClick={handleActivateFree}
                  disabled={freeActivated || activate.isPending}
                  data-testid={`subscribe-${tier.id}`}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 disabled:opacity-60"
                >
                  {freeActivated ? "Активирован" : "Начать бесплатно"}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(tier.contractTierId, tier.priceTokenAmount!)}
                  disabled={!contractConfigured || isActive || isPending}
                  data-testid={`subscribe-${tier.id}`}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:opacity-60"
                >
                  {isActive ? "Активна" : isPending ? "Оформление…" : "Оформить"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
