"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Grants every registration-gift accessory once and marks the free tier as
// activated — real functionality, not just display copy, unlike the other
// three (still-placeholder) tiers. State now lives server-side (see
// api/subscription/activate-free and lib/shop/store.ts) instead of
// localStorage, and only wallet sessions can activate it — same crypto-only
// restriction as the rest of the shop for now.
export function useFreePlan() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["free-plan-activated"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/activate-free");
      const data = await res.json();
      return Boolean(data.activated);
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/activate-free", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to activate free plan");
      return data as { activated: true; owned: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["free-plan-activated"] });
      queryClient.invalidateQueries({ queryKey: ["shop-state"] });
    },
  });

  return { isActivated: query.data ?? false, isLoading: query.isLoading, activate };
}
