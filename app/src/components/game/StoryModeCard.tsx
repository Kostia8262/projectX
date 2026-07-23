"use client";

import { useCharacterAffinity } from "@/hooks/useCharacterAffinity";
import { chaptersFor, getCurrentChapter, getNextChapter } from "@/lib/games/chapters";
import type { CharacterDefinition } from "@/lib/characters/registry";
import { SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>
            Сюжет · глава {current.order}{isLastChapter ? " (финальная)" : ` из ${chapters.length}`}
          </Eyebrow>
          <SectionHeading className="mt-1">{current.chapterTitle}</SectionHeading>
        </div>
        <Button onClick={() => onPlayChapter(current.id)} data-testid="play-chapter">
          Играть главу
        </Button>
      </div>
      {next && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Следующая глава «{next.chapterTitle}» откроется при {next.unlockThreshold} (сейчас{" "}
          {Math.floor(affinity)}).
        </p>
      )}
    </Card>
  );
}
