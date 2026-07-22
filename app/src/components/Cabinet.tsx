"use client";

import { useEffect, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { IMPLEMENTS, type ImplementUnlock } from "@/lib/games/registry";

type SubscriptionStatus = { active: boolean; lastPaidAt: number | null; activeUntil: number | null };

function unlockLabel(unlock: ImplementUnlock, subscribed: boolean): { label: string; owned: boolean } {
  if (unlock === "free") return { label: "Всегда доступно", owned: true };
  if (unlock === "subscription") {
    return subscribed
      ? { label: "Открыто подпиской", owned: true }
      : { label: "Нужна подписка", owned: false };
  }
  return { label: "Покупка (плейсхолдер)", owned: false };
}

export function Cabinet({ address }: { address: string }) {
  const { energy, max } = useEnergyContext();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/subscription/status?address=${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-center text-2xl font-bold text-transparent">
        Кабинет
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
          <p className="text-xs text-neutral-400">Подписка</p>
          {loading ? (
            <p className="mt-1 text-sm text-neutral-500">Загрузка…</p>
          ) : subscription?.active ? (
            <>
              <p className="mt-1 text-lg font-semibold text-emerald-400">Активна</p>
              {subscription.activeUntil && (
                <p className="mt-1 text-xs text-neutral-500">
                  до {new Date(subscription.activeUntil * 1000).toLocaleDateString("ru-RU")}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold text-neutral-400">Не активна</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
          <p className="text-xs text-neutral-400">Энергия</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {energy}/{max}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Восполнение: +1 / 2 мин. Бонус за подписку — впереди.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
        <p className="mb-3 text-sm font-medium text-white">Инвентарь орудий</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {IMPLEMENTS.map((impl) => {
            const { label, owned } = unlockLabel(impl.unlock, subscription?.active ?? false);
            return (
              <div
                key={impl.id}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center ${
                  owned ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-60"
                }`}
              >
                <span className="h-8 w-8 rounded-md" style={{ backgroundColor: impl.color }} />
                <p className="text-xs font-medium text-white">{impl.name}</p>
                <p className="text-[11px] text-neutral-500">{label}</p>
                {!owned && impl.unlock === "purchase" && (
                  <button className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-2 py-1 text-[11px] font-semibold text-white">
                    Купить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
