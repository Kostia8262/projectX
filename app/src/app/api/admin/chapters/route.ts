import { requireAdminRole } from "@/lib/admin/session";
import { canEditGames } from "@/lib/admin/roles";
import { CHARACTERS } from "@/lib/characters/registry";
import { GAMES, IMPLEMENTS } from "@/lib/games/registry";
import type { GameStory, StoryBeat } from "@/lib/games/stories";
import type { ChapterDecision, ChapterDecisionOption, ChapterInput } from "@/lib/content/types";
import { createChapter, updateChapter, deleteChapter } from "@/lib/content/store";

const CHARACTER_IDS = new Set(CHARACTERS.map((c) => c.id));
// Only "chapter"-type games are valid here — a chapter should never end up
// pointed at a "free" pilot (see games/registry.ts's GameType comment).
const CHAPTER_GAME_IDS = new Set(GAMES.filter((g) => g.type === "chapter").map((g) => g.id));
const IMPLEMENT_IDS = new Set(IMPLEMENTS.map((i) => i.id));

function isValidTag(tag: string): boolean {
  if (tag === "fast" || tag === "slow") return true;
  const match = /^implement-(.+)$/.exec(tag);
  return match !== null && IMPLEMENT_IDS.has(match[1]);
}

function parseBeat(raw: unknown): StoryBeat | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== "string" || !r.text.trim()) return null;
  if (r.image !== undefined && typeof r.image !== "string") return null;
  return r.image ? { text: r.text, image: r.image } : { text: r.text };
}

function parseStory(raw: unknown): GameStory | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const intro = parseBeat(r.intro);
  const fallback = parseBeat(r.fallback);
  if (!intro || !fallback) return null;

  const variants: GameStory["variants"] = {};
  if (r.variants !== undefined) {
    if (typeof r.variants !== "object" || r.variants === null) return null;
    for (const [tag, value] of Object.entries(r.variants as Record<string, unknown>)) {
      if (!isValidTag(tag)) return null;
      const beat = parseBeat(value);
      if (!beat) return null;
      variants[tag as keyof GameStory["variants"]] = beat;
    }
  }

  return { intro, fallback, variants };
}

// Branch length is a pure function of order — see the ChapterRecord.branchPath
// comment in lib/content/types.ts: "" at order 1-2, one char at order 3, two
// at order 4. Rejecting anything else here keeps chaptersOnPath's lookup
// (hooks/useChapters.ts) from ever silently missing a malformed variant.
function parseBranchPath(raw: unknown, order: number): string | null {
  if (raw === undefined) return "".length === Math.max(0, order - 2) ? "" : null;
  if (typeof raw !== "string") return null;
  const expectedLength = Math.max(0, order - 2);
  if (raw.length !== expectedLength) return null;
  if (!/^[01]*$/.test(raw)) return null;
  return raw;
}

function parseDecisionOption(raw: unknown, expectedId: "0" | "1"): ChapterDecisionOption | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.id !== expectedId) return null;
  if (typeof r.label !== "string" || !r.label.trim()) return null;
  const result = parseBeat(r.result);
  if (!result) return null;
  return { id: expectedId, label: r.label, result };
}

// Undefined/null means "no decision on this chapter" (valid — chapter 1 never
// has one). Anything else must be a fully-formed decision; there's no
// partial-save state for this field.
function parseDecision(raw: unknown): ChapterDecision | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const prompt = parseBeat(r.prompt);
  if (!prompt) return null;
  if (!Array.isArray(r.options) || r.options.length !== 2) return null;
  const option0 = parseDecisionOption(r.options[0], "0") ?? parseDecisionOption(r.options[1], "0");
  const option1 = parseDecisionOption(r.options[1], "1") ?? parseDecisionOption(r.options[0], "1");
  if (!option0 || !option1) return null;
  return { prompt, options: [option0, option1] };
}

function parseChapterInput(body: unknown): ChapterInput | null {
  if (typeof body !== "object" || body === null) return null;
  const r = body as Record<string, unknown>;

  if (typeof r.characterId !== "string" || !CHARACTER_IDS.has(r.characterId)) return null;
  if (typeof r.gameId !== "string" || !CHAPTER_GAME_IDS.has(r.gameId)) return null;
  if (typeof r.order !== "number" || !Number.isFinite(r.order) || r.order <= 0) return null;
  if (typeof r.unlockThreshold !== "number" || !Number.isFinite(r.unlockThreshold) || r.unlockThreshold < 0)
    return null;
  if (typeof r.chapterTitle !== "string" || !r.chapterTitle.trim()) return null;
  if (typeof r.nextTeaser !== "string" || !r.nextTeaser.trim()) return null;
  const story = parseStory(r.story);
  if (!story) return null;
  const branchPath = parseBranchPath(r.branchPath, r.order);
  if (branchPath === null) return null;
  const decision = parseDecision(r.decision);
  if (decision === null) return null;

  return {
    characterId: r.characterId,
    gameId: r.gameId,
    order: r.order,
    unlockThreshold: r.unlockThreshold,
    chapterTitle: r.chapterTitle,
    nextTeaser: r.nextTeaser,
    story,
    branchPath,
    ...(decision !== undefined ? { decision } : {}),
  };
}

export async function POST(request: Request) {
  const admin = await requireAdminRole(canEditGames);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const input = parseChapterInput(await request.json().catch(() => null));
  if (!input) {
    return Response.json({ error: "Invalid chapter data" }, { status: 400 });
  }

  const chapter = await createChapter(input);
  return Response.json({ chapter });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRole(canEditGames);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  const input = parseChapterInput(body);
  if (!input) {
    return Response.json({ error: "Invalid chapter data" }, { status: 400 });
  }

  const chapter = await updateChapter(id, input);
  if (!chapter) {
    return Response.json({ error: "Chapter not found" }, { status: 404 });
  }
  return Response.json({ chapter });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminRole(canEditGames);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const removed = await deleteChapter(id);
  return Response.json({ removed });
}
