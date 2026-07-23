"use client";

import { useState } from "react";
import type { CharacterDefinition } from "@/lib/characters/registry";
import { isOverrideActive, isRecovering } from "@/lib/characters/override";
import { loadOverride, loadTraits } from "@/lib/characters/storage";
import { relationshipStatusLine, type TraitState } from "@/lib/characters/traits";
import { useEffectiveGames } from "@/hooks/useGameOverrides";
import { StoryModeCard } from "@/components/game/StoryModeCard";
import { PageTitle, SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";

type TraitBarSpec = {
  key: keyof Omit<TraitState, "lastActiveAt">;
  label: string;
  color: string;
  // some traits read as "good" high (affection, submission, pleasure),
  // others "bad" high (boredom, defiance) — flips the bar's tone accordingly
  invert?: boolean;
};

const TRAIT_BARS: TraitBarSpec[] = [
  { key: "submission", label: "Подчинение", color: "#818cf8" },
  { key: "pleasure", label: "Удовольствие", color: "#f472b6" },
  { key: "affection", label: "Влюблённость", color: "#fb7185" },
  { key: "boredom", label: "Скука", color: "#94a3b8", invert: true },
  { key: "defiance", label: "Дерзость", color: "#f97316", invert: true },
];

export function CharacterPage({
  address,
  character,
  onPlayChapter,
  onPlayGame,
  onBack,
}: {
  address: string;
  character: CharacterDefinition;
  onPlayChapter: (chapterId: string) => void;
  onPlayGame: (gameId: string) => void;
  onBack: () => void;
}) {
  const [traits] = useState<TraitState>(() => loadTraits(address, character));
  const [overrideState] = useState(() => loadOverride(address, character.id));
  const games = useEffectiveGames().filter(
    (g) => character.gameIds.includes(g.id) && g.status === "available"
  );

  // Being mid-scene or mid-aftercare is more specific/urgent than the
  // generic trait-threshold buckets relationshipStatusLine falls back to —
  // show it with priority rather than let it get silently swallowed by
  // whichever Boredom/Defiance bucket she also happens to be in right now.
  const statusLine = isOverrideActive(overrideState)
    ? `${character.name} — сцена без ограничений в разгаре (осталось раундов: ${overrideState.roundsRemaining}).`
    : isRecovering(overrideState)
      ? `${character.name} ещё приходит в себя после интенсивной сцены — будьте бережнее.`
      : relationshipStatusLine(traits, character);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <button
        onClick={onBack}
        className="self-start text-sm text-neutral-400 transition hover:text-white"
      >
        ← Персонажи
      </button>

      <Card size="lg">
        <Eyebrow>{character.tagline}</Eyebrow>
        <PageTitle className="mt-1">{character.name}</PageTitle>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{character.bio}</p>
        <p
          className="mt-4 text-sm font-medium text-indigo-300"
          data-testid="relationship-status"
        >
          {statusLine}
        </p>
      </Card>

      <Card size="lg">
        <SectionHeading dense className="mb-4">
          Черты
        </SectionHeading>
        <div className="flex flex-col gap-3">
          {TRAIT_BARS.map((bar) => {
            const value = traits[bar.key];
            return (
              <div key={bar.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">{bar.label}</span>
                  <span className="tabular-nums text-neutral-500" data-testid={`trait-${bar.key}`}>
                    {Math.round(value)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value}%`, backgroundColor: bar.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Предпочитает
            </p>
            <p className="mt-1 text-sm text-neutral-300">{character.preferredNote}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Не форсировать
            </p>
            <p className="mt-1 text-sm text-neutral-300">{character.dislikedNote}</p>
          </div>
        </div>
      </Card>

      <StoryModeCard address={address} character={character} onPlayChapter={onPlayChapter} />

      {games.length > 0 && (
        <Card>
          <SectionHeading dense className="mb-3">
            Свободная игра
          </SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => onPlayGame(game.id)}
                data-testid={`play-${game.id}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                <Eyebrow>{game.tagline}</Eyebrow>
                <p className="mt-1 text-sm font-medium text-white">{game.title}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
