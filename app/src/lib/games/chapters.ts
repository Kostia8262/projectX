import { STORIES, type GameStory } from "./stories";

// Story mode: one continuous narrative per character, each borrowing that
// character's own pilot mechanics as its "verbs" (see characters/registry.ts
// for which gameIds belong to whom). Layered ON TOP of free-play, gated by
// that character's OWN affinity (useCharacterAffinity), not the global
// cross-character Отклик that drives REWARDS.
export type Chapter = {
  id: string;
  characterId: string;
  order: number;
  gameId: string;
  unlockThreshold: number;
  chapterTitle: string;
  story: GameStory;
  // Shown on the finale screen after this chapter's own text — a hook
  // toward what's coming, not a recap of what just happened.
  nextTeaser: string;
};

const CHAPTERS_BY_CHARACTER: Record<string, Chapter[]> = {
  rin: [
    {
      id: "rin-chapter-1",
      characterId: "rin",
      order: 1,
      gameId: "pilot-a",
      unlockThreshold: 0,
      chapterTitle: "Глава 1 — Знакомство",
      story: STORIES["pilot-a"],
      nextTeaser:
        "Сегодня она впервые перестала следить за каждым вашим движением с опаской. В следующий раз выбирать момент будет уже не вам — она сама напишет, когда «прямо сейчас».",
    },
    {
      id: "rin-chapter-2",
      characterId: "rin",
      order: 2,
      gameId: "pilot-c",
      unlockThreshold: 150,
      chapterTitle: "Глава 2 — Украденная минута",
      story: STORIES["pilot-c"],
      nextTeaser:
        "Она вошла во вкус риска быстрее, чем готова была признать — и явно не откажется повторить, если решится предложить это сама. Дальше — за вами обоими.",
    },
  ],
  ada: [
    {
      id: "ada-chapter-1",
      characterId: "ada",
      order: 1,
      gameId: "pilot-d",
      unlockThreshold: 0,
      chapterTitle: "Глава 1 — Проверка на выдержку",
      story: STORIES["pilot-d"],
      nextTeaser:
        "Сегодняшняя проверка была лишь разминкой — она сама это признала, пусть и не сразу. Настоящий разговор о дисциплине всё ещё впереди, и поблажек в нём не будет уже никому.",
    },
    {
      id: "ada-chapter-2",
      characterId: "ada",
      order: 2,
      gameId: "pilot-b",
      unlockThreshold: 150,
      chapterTitle: "Глава 2 — Дисциплина",
      story: STORIES["pilot-b"],
      nextTeaser:
        "Этот урок она запомнит надолго — вопрос лишь в том, вернётся ли к старым привычкам или это станет для неё нормой. Похоже, она и сама не прочь узнать ответ вместе с вами.",
    },
  ],
};

export function chaptersFor(characterId: string): Chapter[] {
  return CHAPTERS_BY_CHARACTER[characterId] ?? [];
}

export function getCurrentChapter(characterId: string, affinity: number): Chapter {
  const chapters = chaptersFor(characterId);
  let current = chapters[0];
  for (const c of chapters) if (affinity >= c.unlockThreshold) current = c;
  return current;
}

export function getNextChapter(current: Chapter): Chapter | undefined {
  const chapters = chaptersFor(current.characterId);
  return chapters.find((c) => c.order === current.order + 1);
}

export function getChapter(chapterId: string): Chapter | undefined {
  for (const chapters of Object.values(CHAPTERS_BY_CHARACTER)) {
    const found = chapters.find((c) => c.id === chapterId);
    if (found) return found;
  }
  return undefined;
}
