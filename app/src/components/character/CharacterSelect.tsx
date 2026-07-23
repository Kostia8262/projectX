"use client";

import { CHARACTERS, type CharacterDefinition } from "@/lib/characters/registry";
import { loadTraits } from "@/lib/characters/storage";
import { relationshipStatusLine } from "@/lib/characters/traits";
import { useCharacterAffinity } from "@/hooks/useCharacterAffinity";
import { getCurrentChapter } from "@/lib/games/chapters";

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
  const currentChapter = getCurrentChapter(character.id, affinity);
  const isBored = traits.boredom > 60;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/30 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl hover:shadow-black/50">
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
            background: `linear-gradient(165deg, ${character.accentColor}, ${character.accentColor}55 60%, #0a0a0f 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        <div className="relative z-10 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/90 drop-shadow">
            {character.tagline}
          </p>
          <h2 className="mt-1 text-3xl font-bold text-white drop-shadow-lg">{character.name}</h2>
          <p className={`mt-2 text-sm ${statusColor(traits.boredom, traits.defiance)}`}>
            {isBored && <span className="mr-1">⏳</span>}
            {relationshipStatusLine(traits, character)}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-3">
        <span className="truncate text-xs text-neutral-500">{currentChapter.chapterTitle}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayChapter(currentChapter.id);
          }}
          data-testid={`continue-${character.id}`}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}

export function CharacterSelect({
  address,
  onSelect,
  onPlayChapter,
}: {
  address: string;
  onSelect: (characterId: string) => void;
  onPlayChapter: (chapterId: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Персонажи
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          У каждой — свой характер, свои механики и своя история.
        </p>
      </div>

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
    </div>
  );
}
