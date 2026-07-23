"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChapterRecord } from "@/lib/content/types";

async function fetchChapters(): Promise<ChapterRecord[]> {
  const res = await fetch("/api/games/chapters");
  if (!res.ok) return [];
  const data = await res.json();
  return data.chapters ?? [];
}

// Shared queryKey so every component reads (and caches) the same list —
// same pattern as useGameOverrides.ts's ["game-overrides"]. Also the key the
// admin chapters page invalidates after create/edit/delete, and the key
// app/page.tsx reads synchronously via queryClient.getQueryData in its
// playChapter click handler (a hook can't be called there).
export function useAllChapters() {
  return useQuery({ queryKey: ["chapters"], queryFn: fetchChapters });
}

// Every variant for this character, across every branch — used by the admin
// page's raw listing, where all variants must stay visible and editable.
export function useChaptersForCharacter(characterId: string): ChapterRecord[] {
  const { data } = useAllChapters();
  return (data ?? [])
    .filter((c) => c.characterId === characterId)
    .sort((a, b) => a.order - b.order);
}

// Exactly one variant per order, picked by the player's own branch path
// (lib/characters/branch.ts) — "" at order 1-2 (single variant), one char of
// branchPath consumed per order after that. Until a decision further up the
// tree has been answered, branchPath is too short to match an order-3/4
// variant at all, so those orders simply don't appear yet (no spoiler of the
// other branch's content).
export function useChaptersOnPath(characterId: string, branchPath: string): ChapterRecord[] {
  const chapters = useChaptersForCharacter(characterId);
  const byOrder = new Map<number, ChapterRecord>();
  for (const c of chapters) {
    const requiredLength = Math.max(0, c.order - 2);
    if (c.branchPath === branchPath.slice(0, requiredLength)) byOrder.set(c.order, c);
  }
  return [...byOrder.values()].sort((a, b) => a.order - b.order);
}

export function useCurrentChapter(
  characterId: string,
  affinity: number,
  branchPath: string
): ChapterRecord | undefined {
  const chapters = useChaptersOnPath(characterId, branchPath);
  let current = chapters[0];
  for (const c of chapters) if (affinity >= c.unlockThreshold) current = c;
  return current;
}

export function useNextChapter(
  current: ChapterRecord | undefined,
  branchPath: string
): ChapterRecord | undefined {
  const chapters = useChaptersOnPath(current?.characterId ?? "", branchPath);
  return current ? chapters.find((c) => c.order === current.order + 1) : undefined;
}

export function useChapter(chapterId: string | undefined): ChapterRecord | undefined {
  const { data } = useAllChapters();
  return chapterId ? data?.find((c) => c.id === chapterId) : undefined;
}
