"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { CHARACTERS } from "@/lib/characters/registry";
import { accessoriesFor } from "@/lib/shop/accessories";
import { TOPUP_PACKAGES } from "@/lib/shop/coinConfig";
import { ERC20_APPROVE_ABI } from "@/lib/erc20Abi";
import { COIN_TOPUP_ABI } from "@/lib/shop/topUpAbi";

const COIN_TOPUP_ADDRESS = process.env.NEXT_PUBLIC_COIN_TOPUP_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
const PAYMENT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS as
  | `0x${string}`
  | undefined;

type ShopState = { balance: number; owned: string[]; discountPercent: number };

async function fetchShopState(): Promise<ShopState> {
  const res = await fetch("/api/shop/state");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить магазин");
  return data;
}

// Ownership and coin balance are now server-authoritative (see
// lib/shop/store.ts) — this component only reflects that state, it never
// grants anything itself the way the old localStorage version did.
export function AccessoryShop() {
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [topUpPending, setTopUpPending] = useState<number | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const stateQuery = useQuery({ queryKey: ["shop-state"], queryFn: fetchShopState });

  const buy = useMutation({
    mutationFn: async (accessoryId: string) => {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось купить");
      return data as ShopState;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["shop-state"], data);
    },
  });

  async function handleTopUp(pkg: (typeof TOPUP_PACKAGES)[number]) {
    if (!COIN_TOPUP_ADDRESS || !PAYMENT_TOKEN_ADDRESS) return;
    setTopUpError(null);
    setTopUpPending(pkg.id);
    try {
      const approveHash = await writeContractAsync({
        address: PAYMENT_TOKEN_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [COIN_TOPUP_ADDRESS, BigInt(pkg.tokenAmount)],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      const topUpHash = await writeContractAsync({
        address: COIN_TOPUP_ADDRESS,
        abi: COIN_TOPUP_ABI,
        functionName: "topUp",
        args: [pkg.id],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: topUpHash });

      // The indexer credits the balance the next time it's asked, not the
      // instant the tx lands — refetch a couple of times to ride out that gap.
      await queryClient.invalidateQueries({ queryKey: ["shop-state"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["shop-state"] }), 3000);
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : "Не удалось пополнить баланс");
    } finally {
      setTopUpPending(null);
    }
  }

  const owned = stateQuery.data?.owned ?? [];
  const balance = stateQuery.data?.balance ?? 0;
  const discountPercent = stateQuery.data?.discountPercent ?? 0;
  const topUpConfigured = Boolean(COIN_TOPUP_ADDRESS && PAYMENT_TOKEN_ADDRESS);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Аксессуары
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Косметика для персонажей — наряды, декор и коллекционные предметы. Без игрового
          эффекта на механики, только внешний вид сцен.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Оплата — внутриигровыми монетами, которые пополняются криптой (USDT/USDC на Polygon).
        </p>
        {discountPercent > 0 && (
          <p className="mt-1 text-xs font-medium text-emerald-400">
            Скидка тарифа применена: −{discountPercent}% на все покупки
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-300">Баланс</span>
          <span className="text-lg font-semibold text-fuchsia-300">
            {stateQuery.isLoading ? "…" : `${balance} монет`}
          </span>
        </div>
        {topUpConfigured ? (
          <div className="flex flex-wrap gap-2">
            {TOPUP_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleTopUp(pkg)}
                disabled={topUpPending !== null}
                data-testid={`topup-${pkg.id}`}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/30 disabled:opacity-50"
              >
                {topUpPending === pkg.id
                  ? "Пополнение…"
                  : `+${pkg.coins} монет${pkg.bonusPercent > 0 ? ` (+${pkg.bonusPercent}%)` : ""}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-400/80">
            Пополнение монет ещё не настроено (нет адреса контракта в конфигурации).
          </p>
        )}
        {topUpError && <p className="text-xs text-rose-400">{topUpError}</p>}
      </div>

      {CHARACTERS.map((character) => {
        // Registration-gift items aren't sold here — they're granted once
        // by activating the free subscription tier (see SubscriptionTiers).
        const items = accessoriesFor(character.id).filter((a) => !a.isRegistrationGift);
        if (items.length === 0) return null;
        return (
          <div key={character.id}>
            <p className="mb-3 text-sm font-medium text-white">{character.name}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                const effectivePrice =
                  discountPercent > 0
                    ? Math.ceil(item.price * (1 - discountPercent / 100))
                    : item.price;
                const canAfford = balance >= effectivePrice;
                const isBuying = buy.isPending && buy.variables === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <span
                      className="h-12 w-full rounded-lg"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="flex-1 text-xs text-neutral-500">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-fuchsia-300">
                        {effectivePrice < item.price && (
                          <span className="mr-1 text-neutral-500 line-through">{item.price}</span>
                        )}
                        {effectivePrice} монет
                      </span>
                      {isOwned ? (
                        <span className="text-xs font-medium text-emerald-400">Куплено</span>
                      ) : (
                        <button
                          onClick={() => buy.mutate(item.id)}
                          disabled={!canAfford || isBuying}
                          data-testid={`buy-${item.id}`}
                          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {isBuying ? "…" : "Купить"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
