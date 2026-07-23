"use client";

import { useQuery } from "@tanstack/react-query";
import { applyGameOverrides, GAMES, type GameDefinition, type GameOverride } from "@/lib/games/registry";

async function fetchGameOverrides(): Promise<Record<string, GameOverride>> {
  const res = await fetch("/api/games/overrides");
  if (!res.ok) return {};
  const data = await res.json();
  return data.overrides ?? {};
}

// Shared queryKey so every component fetches (and caches) the same admin
// edits instead of each issuing its own request — games rarely change
// status/copy mid-session, so a stale-while-revalidate read is fine, and
// while loading we just fall back to the base GAMES array (no admin edits
// applied yet) rather than blocking render on it.
function useGameOverridesMap(): Record<string, GameOverride> {
  const query = useQuery({ queryKey: ["game-overrides"], queryFn: fetchGameOverrides });
  return query.data ?? {};
}

export function useEffectiveGames(): GameDefinition[] {
  return applyGameOverrides(GAMES, useGameOverridesMap());
}

export function useEffectiveGame(gameId: string | undefined): GameDefinition | undefined {
  const games = useEffectiveGames();
  return gameId ? games.find((g) => g.id === gameId) : undefined;
}
