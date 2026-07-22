"use client";

import { CHARACTERS } from "@/lib/characters/registry";
import { loadTraits } from "@/lib/characters/storage";
import { relationshipStatusLine } from "@/lib/characters/traits";

export function CharacterSelect({
  address,
  onSelect,
}: {
  address: string;
  onSelect: (characterId: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Персонажи
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          У каждой — свой характер, свои механики и своя история.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CHARACTERS.map((character) => {
          const traits = loadTraits(address, character);
          return (
            <button
              key={character.id}
              onClick={() => onSelect(character.id)}
              data-testid={`select-${character.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left shadow-xl shadow-black/30 backdrop-blur-2xl transition hover:border-white/20 hover:bg-white/[0.09]"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
                  {character.tagline}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">{character.name}</h2>
              </div>
              <p className="text-sm text-indigo-300">{relationshipStatusLine(traits, character)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
