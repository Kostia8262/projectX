import type { GameStory, StoryBeat } from "@/lib/games/stories";

// A single binary story fork, resolved by an explicit in-the-moment player
// choice (not inferred from how a round was played — see the comment on
// resolveStoryVariant in lib/games/stories.ts for why that signal is too
// noisy/session-scoped for something meant to be remembered across chapters).
export type ChapterDecisionOption = {
  id: "0" | "1";
  label: string; // button text — short imperative, no image
  result: StoryBeat; // shown immediately after picking, replaces the buttons
};

export type ChapterDecision = {
  prompt: StoryBeat;
  options: [ChapterDecisionOption, ChapterDecisionOption];
};

// A short branching VN scene shown fullscreen (components/game/DialogueScene.tsx)
// before or after a chapter's round — purely a narrative bridge, not a
// persisted story-fork like ChapterDecision above: every path is expected to
// converge back to one point (entering the round, or reaching the finale
// modal), just at a different pace. Not enforced at parse time — only
// referential integrity (every next/choice.next resolves to a real node id)
// is validated; that all paths actually converge is on the content author.
export type DialogueChoice = { label: string; next: string };

export type DialogueNode = {
  id: string;
  speaker?: string; // e.g. the character's name or "Вы" — omit for narration
  text: string;
  image?: string; // background for this beat; unset falls back to the character's accent-color gradient
  // Exactly one of these, or neither (a convergence/leaf node that ends the scene):
  next?: string; // linear beat — id of the next node
  choices?: DialogueChoice[]; // a fork — 2+ options, each pointing at a node id
};

export type DialogueTree = { nodes: DialogueNode[] }; // nodes[0] is the entry point

// A chapter's narrative content is a fully independent copy of GameStory —
// deliberately NOT shared with the pilot's free-play STORIES entry (see
// lib/games/stories.ts). Editing a chapter in the admin panel must never
// change what free-play shows for the same gameId, and vice versa.
export type ChapterRecord = {
  id: string;
  characterId: string;
  gameId: string;
  order: number;
  unlockThreshold: number;
  chapterTitle: string;
  story: GameStory;
  nextTeaser: string;
  // Which branch of the decision tree this variant belongs to: "" for the
  // single order-1/2 variant, "0"/"1" for order-3, "00".."11" for order-4.
  // Length is always max(0, order - 2) — see chaptersOnPath in
  // hooks/useChapters.ts for how a player's own path (lib/characters/branch.ts)
  // picks exactly one variant per order.
  branchPath: string;
  // Absent on order-1 (no fork yet). Present on every order-2/3/4 variant —
  // answering it appends one more character to the player's branch path.
  decision?: ChapterDecision;
  hints: ChapterHints;
  // All three optional and independent — a chapter can have any combination,
  // or none. Absent means "skip the scene, keep today's behavior".
  introDialogue?: DialogueTree; // shown before the round starts
  outroDialogue?: DialogueTree; // shown after the round ends, before the finale modal
  // Shown AFTER the finale modal (story text/nextTeaser/decision) has been
  // read and, if present, its decision answered — an "afterglow" scene, not
  // a reaction to the round itself. Absent skips straight from the finale
  // modal's own buttons to the next chapter/replay, same as today.
  epilogueDialogue?: DialogueTree;
};

// Short in-character reaction lines the girl can "say" mid-round, shown as a
// fading popup (components/game/CharacterHint.tsx). Each line is anchored to
// a specific in-game moment rather than floating in one flat pool — that's
// what makes the admin timeline (admin/chapters/ChapterForm.tsx) legible:
// every reply on screen has one obvious trigger.
export type ChapterHints = {
  // One bucket per lib/games/registry.ts's HEAT_STAGES entry, same order and
  // length (index 0 = "Спокойно" ... index 4 = "Предел") — a line from
  // bucket N is shown when the player's heat crosses into stage N during a
  // round. HEAT_STAGES is a fixed, shared timeline (same 5 stages for every
  // game), so this shape needs no chapter-specific stage list of its own.
  stage: [string[], string[], string[], string[], string[]];
  // Shown instead when the player taps while their selected implement is
  // blocked (trait/freshness gate, lib/characters/traits.ts) — a separate
  // "moment" from the heat timeline since it can happen at any stage.
  blocked: string[];
};

// Same order as ChapterHints.stage — kept here (not derived from
// games/registry.ts's HEAT_STAGES.length) so content/types.ts has no runtime
// dependency on games/registry.ts, only a number both sides agree on.
export const CHAPTER_HINT_STAGE_COUNT = 5;

export function emptyChapterHints(): ChapterHints {
  return { stage: [[], [], [], [], []], blocked: [] };
}

// No `id` yet — the store assigns one on create.
export type ChapterInput = Omit<ChapterRecord, "id">;
