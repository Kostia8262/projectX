"use client";

import { useEffect, useState } from "react";
import { GAMES } from "@/lib/games/registry";

function heatLifetimeKey(address: string, gameId: string) {
  return `kink-spank-heat-lifetime-${gameId}-${address.toLowerCase()}`;
}

function readAffinity(address: string): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const game of GAMES) {
    if (game.status !== "available") continue;
    total += Number(window.localStorage.getItem(heatLifetimeKey(address, game.id)) ?? "0") || 0;
  }
  return Math.floor(total);
}

// Reads the combined progress meter fed by every mini-game. Deliberately
// re-read-on-demand rather than fully live-synced across components — each
// game owns its own state while playing, and the shared total only needs to
// be current when the player is back on the menu looking at it.
export function useSharedAffinity(address: string) {
  const [affinity, setAffinity] = useState(() => readAffinity(address));

  const refresh = () => setAffinity(readAffinity(address));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return { affinity, refresh };
}
