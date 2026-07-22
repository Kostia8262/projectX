"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createInitialEnergy,
  regenEnergy,
  refillEnergy,
  ENERGY_MAX,
  type EnergyState,
} from "@/lib/games/energy";
import { ADMIN_ENERGY, isAdminAddress } from "@/lib/admin";

function storageKey(address: string) {
  return `kink-energy-${address.toLowerCase()}`;
}

function loadEnergy(address: string): EnergyState {
  if (typeof window === "undefined") return createInitialEnergy();
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return createInitialEnergy();
    return regenEnergy(JSON.parse(raw) as EnergyState);
  } catch {
    return createInitialEnergy();
  }
}

type EnergyContextValue = {
  energy: number;
  max: number;
  spend: (amount?: number) => boolean;
  refill: () => void;
};

const EnergyContext = createContext<EnergyContextValue | null>(null);

// Single shared instance for the whole authenticated app — every consumer
// (header badge, in-game readout, cabinet) reads and writes the SAME state,
// instead of each calling its own copy of the hook and drifting out of sync
// with each other.
export function EnergyProvider({ address, children }: { address: string; children: ReactNode }) {
  const isAdmin = isAdminAddress(address);
  const stateRef = useRef<EnergyState>(loadEnergy(address));
  const [, bump] = useState(0);
  const forceRender = () => bump((n) => n + 1);

  useEffect(() => {
    if (isAdmin) return;
    window.localStorage.setItem(storageKey(address), JSON.stringify(stateRef.current));
  });

  useEffect(() => {
    if (isAdmin) return;
    const id = setInterval(() => {
      stateRef.current = regenEnergy(stateRef.current);
      forceRender();
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spend(amount: number = 1): boolean {
    if (isAdmin) return true;
    const regened = regenEnergy(stateRef.current);
    if (regened.current < amount) {
      stateRef.current = regened;
      forceRender();
      return false;
    }
    stateRef.current = { ...regened, current: regened.current - amount };
    forceRender();
    return true;
  }

  function refill() {
    stateRef.current = refillEnergy();
    forceRender();
  }

  return (
    <EnergyContext.Provider
      value={
        isAdmin
          ? { energy: ADMIN_ENERGY, max: ADMIN_ENERGY, spend, refill }
          : { energy: stateRef.current.current, max: ENERGY_MAX, spend, refill }
      }
    >
      {children}
    </EnergyContext.Provider>
  );
}

export function useEnergyContext(): EnergyContextValue {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergyContext must be used within an EnergyProvider");
  return ctx;
}
