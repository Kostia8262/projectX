"use client";

import { useSubscriptionStatus } from "@/lib/subscription/status";
import { useFreePlan } from "@/lib/subscription/freePlan";

const BANNER_CLASS =
  "mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] px-4 py-2.5 text-left text-sm text-neutral-300 transition hover:border-fuchsia-400/40";

// Three states, deliberately not just "active/inactive":
// 1. No paid tier AND free plan not activated — nudge toward the free tier
//    (fast, no-commitment CTA), not straight at a paid upsell.
// 2. No paid tier BUT free plan activated — the player already has *a*
//    subscription, so "нет подписки" would be a lie; this is an upsell
//    toward paid tiers instead.
// 3. Paid tier active — hidden entirely. Nagging a paying subscriber for
//    more money on every visit to the character list is the wrong call.
export function SubscriptionStatusBanner({
  onGoToSubscription,
}: {
  onGoToSubscription: () => void;
}) {
  const statusQuery = useSubscriptionStatus();
  const { isActivated: freeActivated, isLoading: freeLoading } = useFreePlan();

  if (statusQuery.isLoading || freeLoading) return null;
  if (statusQuery.data?.active) return null;

  if (freeActivated) {
    return (
      <button
        onClick={onGoToSubscription}
        data-testid="subscription-banner-free"
        className={BANNER_CLASS}
      >
        <span>
          Бесплатный тариф активен. Больше орудий, глав и скидка в магазине — на платных тарифах.
        </span>
        <span className="shrink-0 font-semibold text-fuchsia-300">Смотреть тарифы →</span>
      </button>
    );
  }

  return (
    <button
      onClick={onGoToSubscription}
      data-testid="subscription-banner-inactive"
      className={BANNER_CLASS}
    >
      <span>Ещё не выбрали тариф — бесплатный открывает первые главы за 10 секунд.</span>
      <span className="shrink-0 font-semibold text-fuchsia-300">Начать бесплатно →</span>
    </button>
  );
}
