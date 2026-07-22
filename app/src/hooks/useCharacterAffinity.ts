"use client";

import { useEffect, useState } from "react";
import type { CharacterDefinition } from "@/lib/characters/registry";

function heatLifetimeKey(address: string, gameId: string) {
  return `kink-spank-heat-lifetime-${gameId}-${address.toLowerCase()}`;
}

function readAffinity(address: string, character: CharacterDefinition): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const gameId of character.gameIds) {
    total += Number(window.localStorage.getItem(heatLifetimeKey(address, gameId)) ?? "0") || 0;
  }
  return Math.floor(total);
}

// Separate from useSharedAffinity (the global "Отклик" that gates REWARDS
// across all 4 games) — this is scoped to just one character's own two
// pilot mechanics, so playing Рин doesn't push Ада's chapter unlocks.
export function useCharacterAffinity(address: string, character: CharacterDefinition) {
  const [affinity, setAffinity] = useState(() => readAffinity(address, character));

  const refresh = () => setAffinity(readAffinity(address, character));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, character.id]);

  return { affinity, refresh };
}
