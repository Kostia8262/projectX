"use client";

import { useQuery } from "@tanstack/react-query";

// Paid-tier status only (tierId 1-3) — the free tier is a separate flag,
// see useFreePlan(). Shared between SubscriptionTiers.tsx and
// SubscriptionStatusBanner.tsx so both read/invalidate the same cache
// entry instead of drifting out of sync after a subscribe() call.
export type SubscriptionStatus = { active: boolean; tierId: number | null };

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch("/api/subscription/status");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить статус подписки");
  return data;
}

export function useSubscriptionStatus() {
  return useQuery({ queryKey: ["subscription-status"], queryFn: fetchSubscriptionStatus });
}
