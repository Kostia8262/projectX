"use client";

import { useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { ENERGY_REFILL_COST_COINS } from "@/lib/shop/coinConfig";

// Energy stays free/time-regenerating — this is the optional shortcut: pay
// coins (the real, server-tracked economy) to skip the wait. The debit
// happens server-side (see api/shop/refill-energy); only on success do we
// touch the client-side energy pool via the existing refill().
export function useEnergyRefill() {
  const { refill } = useEnergyContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buyRefill() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/refill-energy", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось восполнить энергию");
        return;
      }
      refill();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setPending(false);
    }
  }

  return { buyRefill, pending, error, cost: ENERGY_REFILL_COST_COINS };
}
