// Which branch of a character's chapter tree this player is on — per
// character, per wallet address, same localStorage pattern as
// characters/storage.ts. Separate from that file because this isn't a trait
// or a resource: it's the player's own accumulated answers to chapter
// decisions (see lib/content/types.ts's ChapterDecision), read by
// hooks/useChapters.ts's useChaptersOnPath to pick which variant of each
// order to show.
function branchKey(characterId: string, address: string): string {
  return `kink-branch-${characterId}-${address.toLowerCase()}`;
}

export function loadBranchPath(address: string, characterId: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(branchKey(characterId, address)) ?? "";
}

// decisionIndex = chapter.order - 2 (0 for the decision at the end of
// chapter 2, 1 for chapter 3, 2 for chapter 4). Truncating the stored path to
// decisionIndex before appending means replaying an earlier decision with a
// different answer automatically invalidates everything chosen after it —
// nothing further down the old branch will match chaptersOnPath anymore.
export function recordBranchChoice(
  address: string,
  characterId: string,
  decisionIndex: number,
  optionId: string
): string {
  const current = loadBranchPath(address, characterId);
  const next = current.slice(0, decisionIndex) + optionId;
  window.localStorage.setItem(branchKey(characterId, address), next);
  return next;
}
