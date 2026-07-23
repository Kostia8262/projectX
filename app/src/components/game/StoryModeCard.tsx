"use client";

import { useState } from "react";
import { useCharacterAffinity } from "@/hooks/useCharacterAffinity";
import { useCharacterBranch } from "@/hooks/useCharacterBranch";
import { useChaptersOnPath, useCurrentChapter, useNextChapter } from "@/hooks/useChapters";
import type { CharacterDefinition } from "@/lib/characters/registry";
import { SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Story mode sits ALONGSIDE free-play (this character's own pilot games
// stay independently playable too) rather than replacing it — this card is
// a recommended next step through one continuous per-character narrative
// that reuses that character's own mechanics as its "verbs".
//
// Pagination lets players page back through already-unlocked chapters to
// replay them (or peek ahead at locked ones) without losing the
// affinity-driven "current" chapter as the default landing spot.
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
  const { branchPath } = useCharacterBranch(address, character.id);
  const chapters = useChaptersOnPath(character.id, branchPath);
  const current = useCurrentChapter(character.id, affinity, branchPath);
  const next = useNextChapter(current, branchPath);

  // Tracks the player's own pagination choice once they make one; before
  // that (and whenever they haven't paged away) it follows `current` live —
  // so the card lands on the right chapter as soon as chapters finish
  // loading, without an effect to sync it after the fact.
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const viewIndex = manualIndex ?? (current ? current.order - 1 : 0);
  const viewed = chapters[viewIndex] ?? current;

  // Nothing to show yet (still loading) or nothing to show at all (admin
  // deleted every chapter for this character) — free-play stays available
  // either way via the sibling "Свободная игра" card.
  if (!current || !viewed) return null;

  const isUnlocked = affinity >= viewed.unlockThreshold;
  const isViewingCurrent = viewed.id === current.id;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {viewed.story.intro.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewed.story.intro.image}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          )}
          <div>
            <Eyebrow>
              Сюжет · глава {viewed.order} из {chapters.length}
              {isViewingCurrent && " · текущая"}
            </Eyebrow>
            <SectionHeading className="mt-1">{viewed.chapterTitle}</SectionHeading>
          </div>
        </div>
        <Button
          onClick={() => onPlayChapter(viewed.id)}
          disabled={!isUnlocked}
          data-testid="play-chapter"
        >
          {isUnlocked ? (isViewingCurrent ? "Играть главу" : "Пройти заново") : "Заблокировано"}
        </Button>
      </div>

      {!isUnlocked && (
        <p className="mt-3 text-xs text-neutral-500">
          Откроется при {viewed.unlockThreshold} (сейчас {Math.floor(affinity)}).
        </p>
      )}
      {isUnlocked && isViewingCurrent && next && (
        <p className="mt-3 text-xs text-neutral-500">
          Следующая глава «{next.chapterTitle}» откроется при {next.unlockThreshold} (сейчас{" "}
          {Math.floor(affinity)}).
        </p>
      )}

      {chapters.length > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setManualIndex(Math.max(0, viewIndex - 1))}
            disabled={viewIndex === 0}
            data-testid="chapter-prev"
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Пред.
          </button>
          <div className="flex gap-1.5">
            {chapters.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setManualIndex(i)}
                aria-label={`Глава ${c.order}`}
                data-testid={`chapter-dot-${c.order}`}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === viewIndex ? "bg-white" : "bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setManualIndex(Math.min(chapters.length - 1, viewIndex + 1))}
            disabled={viewIndex === chapters.length - 1}
            data-testid="chapter-next"
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            След. →
          </button>
        </div>
      )}
    </Card>
  );
}
