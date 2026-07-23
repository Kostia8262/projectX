"use client";

import { useEnergyContext } from "@/contexts/EnergyContext";
import { PILL_SHAPE_CLASS } from "@/components/ui/Badge";

export function EnergyBadge() {
  const { energy, max } = useEnergyContext();
  const low = energy <= max * 0.2;

  return (
    <span
      className={`${PILL_SHAPE_CLASS} font-medium tabular-nums ${
        low ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.06] text-neutral-300"
      }`}
      title="Энергия — тратится на каждое действие в играх"
    >
      ⚡ {energy}/{max}
    </span>
  );
}
