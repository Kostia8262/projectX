"use client";

import { useCharacterAffinity } from "@/hooks/useCharacterAffinity";
import { chaptersFor, getCurrentChapter, getNextChapter } from "@/lib/games/chapters";
import type { CharacterDefinition } from "@/lib/characters/registry";

// Story mode sits ALONGSIDE free-play (this character's own pilot games
// stay independently playable too) rather than replacing it — this card is
// a recommended next step through one continuous per-character narrative
// that reuses that character's own mechanics as its "verbs".
export function StoryModeCard({
  address,
  character,
  onPlayChapter,
}: {
  address: string;
  character: CharacterDefinition;
  onPlayChapter: (chapterId: string) => void;
}) {
  const { affinity } = useCharacterAffinity(address, character);
  const chapters = chaptersFor(character.id);
  const current = getCurrentChapter(character.id, affinity);
  const next = getNextChapter(current);
  const isLastChapter = current.order === chapters.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300/80">
            Сюжет · глава {current.order}{isLastChapter ? " (финальная)" : ` из ${chapters.length}`}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{current.chapterTitle}</h2>
        </div>
        <button
          onClick={() => onPlayChapter(current.id)}
          data-testid="play-chapter"
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
        >
          Играть главу
        </button>
      </div>
      {next && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Следующая глава «{next.chapterTitle}» откроется при {next.unlockThreshold} (сейчас{" "}
          {Math.floor(affinity)}).
        </p>
      )}
    </div>
  );
}
