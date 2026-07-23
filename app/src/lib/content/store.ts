import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ChapterRecord, ChapterInput } from "./types";
import { SEED_CHAPTERS } from "./seed";

// Same file-per-concern persistence pattern as lib/shop/store.ts — a single
// JSON file, not a real database (see that file's comment for why). Kept
// separate from shop-store.json on purpose: chapters are narrative content,
// not economy/admin-roster state, and don't belong in the same blob.
type ContentState = {
  chapters: Record<string, ChapterRecord>; // id -> record
};

function seedState(): ContentState {
  const chapters: Record<string, ChapterRecord> = {};
  for (const chapter of SEED_CHAPTERS) chapters[chapter.id] = chapter;
  return { chapters };
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "content-store.json");

let cached: ContentState | null = null;

async function load(): Promise<ContentState> {
  if (cached) return cached;
  let state: ContentState;
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    state = JSON.parse(raw) as ContentState;
  } catch {
    // First run (or file missing/corrupt) — seed from the current hardcoded
    // chapters so the game has content to show before any admin edit.
    state = seedState();
  }
  cached = state;
  return cached;
}

async function persist(state: ContentState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Same serialize-concurrent-writes queue as shop/store.ts.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}

export async function listChapters(): Promise<ChapterRecord[]> {
  return enqueue(async () => {
    const state = await load();
    return Object.values(state.chapters);
  });
}

export async function getChapterRecord(id: string): Promise<ChapterRecord | undefined> {
  return enqueue(async () => {
    const state = await load();
    return state.chapters[id];
  });
}

export async function createChapter(input: ChapterInput): Promise<ChapterRecord> {
  return enqueue(async () => {
    const state = await load();
    const record: ChapterRecord = { ...input, id: randomUUID() };
    state.chapters[record.id] = record;
    await persist(state);
    return record;
  });
}

export async function updateChapter(
  id: string,
  patch: Partial<ChapterInput>
): Promise<ChapterRecord | null> {
  return enqueue(async () => {
    const state = await load();
    const existing = state.chapters[id];
    if (!existing) return null;
    const updated: ChapterRecord = { ...existing, ...patch, id };
    state.chapters[id] = updated;
    await persist(state);
    return updated;
  });
}

export async function deleteChapter(id: string): Promise<boolean> {
  return enqueue(async () => {
    const state = await load();
    if (!state.chapters[id]) return false;
    delete state.chapters[id];
    await persist(state);
    return true;
  });
}
