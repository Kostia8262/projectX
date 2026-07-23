"use client";

import { useEffect, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { useSiweSession } from "@/hooks/useSiweSession";
import { useSharedAffinity } from "@/hooks/useSharedAffinity";
import { useFreePlan } from "@/lib/subscription/freePlan";
import { useSubscriptionStatus } from "@/lib/subscription/status";
import { IMPLEMENTS, type ImplementUnlock } from "@/lib/games/registry";
import { CHARACTERS } from "@/lib/characters/registry";
import { loadTraits } from "@/lib/characters/storage";
import { ACHIEVEMENTS, computeUnlocked } from "@/lib/achievements";
import { RewardsPanel } from "@/components/game/RewardsPanel";
import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button, BRAND_GRADIENT_CLASS } from "@/components/ui/Button";

type ShopState = { balance: number; owned: string[] } | null;

function unlockLabel(unlock: ImplementUnlock, subscribed: boolean): { label: string; owned: boolean } {
  if (unlock === "free") return { label: "Всегда доступно", owned: true };
  if (unlock === "subscription") {
    return subscribed
      ? { label: "Открыто подпиской", owned: true }
      : { label: "Нужна подписка", owned: false };
  }
  return { label: "Покупка (плейсхолдер)", owned: false };
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left"
    >
      <span className="text-sm text-white">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          value ? BRAND_GRADIENT_CLASS : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

type Tab = "profile" | "progress" | "inventory" | "achievements" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Профиль" },
  { id: "progress", label: "Прогресс" },
  { id: "inventory", label: "Инвентарь" },
  { id: "achievements", label: "Достижения" },
  { id: "settings", label: "Настройки" },
];

export function Cabinet({ address }: { address: string }) {
  const [tab, setTab] = useState<Tab>("profile");
  const { signOut } = useSiweSession();
  const { energy, max } = useEnergyContext();
  const { isActivated: freeActivated } = useFreePlan();
  const { affinity } = useSharedAffinity(address);
  const statusQuery = useSubscriptionStatus();
  const subscription = statusQuery.data;
  const subLoading = statusQuery.isLoading;
  const [shop, setShop] = useState<ShopState>(null);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/state")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setShop(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const traitsByCharacter = CHARACTERS.map((c) => loadTraits(address, c));
  const unlocked = computeUnlocked({
    affinity,
    traitsByCharacter,
    ownedCount: shop?.owned.length ?? 0,
    freePlanActivated: freeActivated,
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-6 px-6 py-10">
      <nav className="flex w-44 shrink-0 flex-col gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-left text-sm transition ${
              tab === t.id
                ? "bg-white/10 font-semibold text-white"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1">
        {tab === "profile" && (
          <div className="flex flex-col gap-4">
            <PageTitle>Профиль</PageTitle>
            <Card>
              <p className="text-xs text-neutral-400">Кошелёк</p>
              <p className="mt-1 break-all font-mono text-sm text-white">{address}</p>
              <Button onClick={() => signOut.mutate()} variant="secondary" size="sm" className="mt-3">
                Выйти
              </Button>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-xs text-neutral-400">Подписка</p>
                {subLoading ? (
                  <p className="mt-1 text-sm text-neutral-500">Загрузка…</p>
                ) : subscription?.active ? (
                  <p className="mt-1 text-lg font-semibold text-emerald-400">Активна</p>
                ) : freeActivated ? (
                  <>
                    <p className="mt-1 text-lg font-semibold text-teal-400">Бесплатный тариф</p>
                    <p className="mt-1 text-xs text-neutral-500">Платная не оформлена.</p>
                  </>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-neutral-400">Не активна</p>
                )}
              </Card>
              <Card>
                <p className="text-xs text-neutral-400">Энергия</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {energy}/{max}
                </p>
                <p className="mt-1 text-xs text-neutral-500">Восполнение: +1/мин.</p>
              </Card>
              <Card>
                <p className="text-xs text-neutral-400">Монеты</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {shop ? shop.balance : "…"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">Для покупок в магазине.</p>
              </Card>
            </div>
          </div>
        )}

        {tab === "progress" && (
          <div className="flex flex-col gap-4">
            <PageTitle>Прогресс</PageTitle>
            <RewardsPanel address={address} />
          </div>
        )}

        {tab === "inventory" && (
          <div className="flex flex-col gap-4">
            <PageTitle>Инвентарь орудий</PageTitle>
            <Card>
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
                      <p className="text-xs text-neutral-500">{label}</p>
                      {!owned && impl.unlock === "purchase" && (
                        <Button size="sm">Купить</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab === "achievements" && (
          <div className="flex flex-col gap-4">
            <PageTitle>Достижения</PageTitle>
            <Card>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ACHIEVEMENTS.map((a) => {
                  const isUnlocked = unlocked.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col gap-1 rounded-xl border p-3 ${
                        isUnlocked ? "border-emerald-400/20 bg-emerald-500/[0.06]" : "border-white/5 bg-white/[0.01] opacity-60"
                      }`}
                    >
                      <p className={`text-sm font-medium ${isUnlocked ? "text-emerald-300" : "text-neutral-400"}`}>
                        {isUnlocked ? "✓ " : "🔒 "}
                        {a.title}
                      </p>
                      <p className="text-xs text-neutral-500">{a.description}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab === "settings" && (
          <div className="flex flex-col gap-4">
            <PageTitle>Настройки</PageTitle>
            <Card>
              <div className="flex flex-col gap-3">
                <ToggleRow label="Звук" value={sound} onChange={setSound} />
                <ToggleRow label="Вибрация" value={haptics} onChange={setHaptics} />
                <p className="text-xs text-neutral-500">
                  Плейсхолдеры — реального звука/вибрации пока нет.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
