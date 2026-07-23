"use client";

import { useEffect, useState } from "react";

type Status = { active: boolean; activeUntil: number | null } | null;

export function SubscriptionStatusBanner({
  onGoToSubscription,
}: {
  onGoToSubscription: () => void;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  if (status?.active) {
    return (
      <div
        className="mx-auto w-full max-w-3xl rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-300"
        data-testid="subscription-banner-active"
      >
        Подписка активна
        {status.activeUntil
          ? ` до ${new Date(status.activeUntil * 1000).toLocaleDateString("ru-RU")}`
          : ""}
      </div>
    );
  }

  return (
    <button
      onClick={onGoToSubscription}
      data-testid="subscription-banner-inactive"
      className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] px-4 py-2.5 text-left text-sm text-neutral-300 transition hover:border-fuchsia-400/40"
    >
      <span>Нет активной подписки — часть орудий и глав пока недоступна.</span>
      <span className="shrink-0 font-semibold text-fuchsia-300">Оформить →</span>
    </button>
  );
}
