"use client";

import { CHARACTERS, type CharacterDefinition } from "@/lib/characters/registry";
import { loadTraits } from "@/lib/characters/storage";
import { relationshipStatusLine } from "@/lib/characters/traits";
import { useCharacterAffinity } from "@/hooks/useCharacterAffinity";
import { useCharacterBranch } from "@/hooks/useCharacterBranch";
import { useCurrentChapter } from "@/hooks/useChapters";
import { PageTitle } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NotificationBell } from "@/components/character/IntroNotifications";

function statusColor(boredom: number, defiance: number): string {
  if (boredom > 60) return "text-amber-300";
  if (defiance > 60) return "text-orange-300";
  return "text-indigo-200";
}

function CharacterCard({
  character,
  address,
  onSelect,
  onPlayChapter,
}: {
  character: CharacterDefinition;
  address: string;
  onSelect: (characterId: string) => void;
  onPlayChapter: (chapterId: string) => void;
}) {
  const traits = loadTraits(address, character);
  const { affinity } = useCharacterAffinity(address, character);
  const { branchPath } = useCharacterBranch(address, character.id);
  const currentChapter = useCurrentChapter(character.id, affinity, branchPath);
  const isBored = traits.boredom > 60;

  return (
    // Hover state mirrors Card's "elevated" shadow tier (shadow-2xl shadow-black/40)
    // — kept as a literal hover: pair here since Tailwind's class scanner needs
    // the full class name in source and can't see it built from a JS template.
    <Card
      size="none"
      className="group relative flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl hover:shadow-black/40"
    >
      <NotificationBell character={character} className="right-3 top-3" />

      {/* Poster-style hero area — full-bleed color placeholder for now,
          swaps for real character art later without changing this layout. */}
      <button
        onClick={() => onSelect(character.id)}
        data-testid={`select-${character.id}`}
        className="relative flex h-72 w-full flex-col justify-end overflow-hidden text-left sm:h-80 lg:h-96"
      >
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-110"
          style={{
            background: `linear-gradient(165deg, ${character.accentColor}, ${character.accentColor}55 60%, #0a0a0a 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        <div className="relative z-10 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/90 drop-shadow">
            {character.tagline}
          </p>
          <PageTitle as="h2" plain className="mt-1">
            {character.name}
          </PageTitle>
          <p className={`mt-2 text-sm ${statusColor(traits.boredom, traits.defiance)}`}>
            {isBored && <span className="mr-1">⏳</span>}
            {relationshipStatusLine(traits, character)}
          </p>
        </div>
      </button>

      {currentChapter && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-3">
          <span className="truncate text-xs text-neutral-500">{currentChapter.chapterTitle}</span>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPlayChapter(currentChapter.id);
            }}
            data-testid={`continue-${character.id}`}
            size="sm"
            className="shrink-0"
          >
            Продолжить
          </Button>
        </div>
      )}
    </Card>
  );
}

export function CharacterSelect({
  address,
  onSelect,
  onPlayChapter,
  banner,
}: {
  address: string;
  onSelect: (characterId: string) => void;
  onPlayChapter: (chapterId: string) => void;
  banner?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <PageTitle>Персонажи</PageTitle>
        <p className="mt-2 text-sm text-neutral-400">
          У каждой — свой характер, свои механики и своя история.
        </p>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {CHARACTERS.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              address={address}
              onSelect={onSelect}
              onPlayChapter={onPlayChapter}
            />
          ))}
        </div>

        {/* Pinned outside the standard grid's width rather than taking a
            flex column inside it, so the grid itself stays the normal
            (non-sidebar) layout at every breakpoint. */}
        {banner && (
          <div className="mt-6 w-full lg:absolute lg:left-full lg:top-0 lg:mt-0 lg:ml-6 lg:w-64">
            {banner}
          </div>
        )}
      </div>
    </div>
  );
}
