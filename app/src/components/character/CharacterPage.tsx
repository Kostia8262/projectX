"use client";

import { useState } from "react";
import type { CharacterDefinition } from "@/lib/characters/registry";
import { isOverrideActive, isRecovering } from "@/lib/characters/override";
import { getIdleRecap, loadOverride, loadTraits } from "@/lib/characters/storage";
import { relationshipStatusLine, type IdleRecapDeltas, type TraitState } from "@/lib/characters/traits";
import { TRAIT_BARS } from "@/lib/characters/traitBars";
import { useEffectiveGames } from "@/hooks/useGameOverrides";
import { StoryModeCard } from "@/components/game/StoryModeCard";
import { PageTitle, SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/Tooltip";

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function formatIdleDuration(hours: number): string {
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `${h} ${pluralRu(h, "час", "часа", "часов")}`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

// Order matches how urgently each shift is worth flagging — Boredom/Defiance
// (fast, hours-scale drift) before Affection/Submission (slow, days-scale
// neglect) — not TRAIT_BARS' display order, which is unrelated.
const RECAP_DELTA_LABELS: { key: keyof IdleRecapDeltas; label: string }[] = [
  { key: "boredom", label: "скука" },
  { key: "defiance", label: "дерзость" },
  { key: "affection", label: "влюблённость" },
  { key: "submission", label: "подчинение" },
];

function IdleRecapBanner({
  deltas,
  elapsedHours,
  onDismiss,
}: {
  deltas: IdleRecapDeltas;
  elapsedHours: number;
  onDismiss: () => void;
}) {
  const parts = RECAP_DELTA_LABELS.filter(({ key }) => Math.abs(deltas[key]) >= 1).map(
    ({ key, label }) => `${label} ${deltas[key] > 0 ? "+" : ""}${Math.round(deltas[key])}`
  );
  if (parts.length === 0) return null;
  return (
    <div
      data-testid="idle-recap-banner"
      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-neutral-300"
    >
      <p>
        <span className="text-neutral-500">Пока вас не было ({formatIdleDuration(elapsedHours)}):</span>{" "}
        {parts.join(", ")}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Скрыть"
        className="shrink-0 text-neutral-500 transition hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

export function CharacterPage({
  address,
  character,
  onPlayChapter,
  onPlayGame,
  onOpenHistory,
  onBack,
}: {
  address: string;
  character: CharacterDefinition;
  onPlayChapter: (chapterId: string) => void;
  onPlayGame: (gameId: string) => void;
  onOpenHistory: () => void;
  onBack: () => void;
}) {
  const [traits] = useState<TraitState>(() => loadTraits(address, character));
  const [overrideState] = useState(() => loadOverride(address, character.id));
  const [recap] = useState(() => getIdleRecap(address, character));
  // Keyed by lastActiveAt (unchanged by decay — see applyTimeDecay) so the
  // same absence only ever shows once per browser session; a NEW absence
  // after the next played round gets a fresh key and shows again.
  const recapDismissKey = `kink-recap-seen-${character.id}-${address.toLowerCase()}-${traits.lastActiveAt}`;
  const [recapDismissed, setRecapDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(recapDismissKey) === "1";
  });
  const games = useEffectiveGames().filter(
    (g) => character.gameIds.includes(g.id) && g.status === "available" && g.type === "free"
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6">
      <button
        onClick={onBack}
        className="self-start text-sm text-neutral-400 transition hover:text-white"
      >
        ← Персонажи
      </button>

      {recap && !recapDismissed && (
        <IdleRecapBanner
          deltas={recap.deltas}
          elapsedHours={recap.elapsedHours}
          onDismiss={() => {
            setRecapDismissed(true);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(recapDismissKey, "1");
            }
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <div
          className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-center text-neutral-500 lg:sticky lg:top-6"
          data-testid="character-portrait-placeholder"
        >
          <span className="text-sm">Портрет персонажа</span>
          <span className="text-xs text-neutral-600">Изображение будет добавлено позже</span>

          <button
            type="button"
            onClick={onOpenHistory}
            data-testid="open-history"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-10 text-left transition hover:from-black"
          >
            <Eyebrow className="text-white/70">Её история</Eyebrow>
            <p className="line-clamp-2 text-xs italic leading-relaxed text-neutral-200">
              {character.history}
            </p>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Card size="sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PageTitle className="text-xl">{character.name}</PageTitle>
              <Eyebrow>{character.tagline}</Eyebrow>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{character.bio}</p>
            <p
              className="mt-2 text-xs font-medium text-indigo-300"
              data-testid="relationship-status"
            >
              {statusLine}
            </p>

            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {TRAIT_BARS.map((bar) => {
                const value = traits[bar.key];
                return (
                  <div key={bar.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-neutral-400">
                        {bar.label}
                        <InfoTooltip text={character.traitNotes[bar.key]} />
                      </span>
                      <span className="tabular-nums text-neutral-500" data-testid={`trait-${bar.key}`}>
                        {Math.round(value)}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${value}%`, backgroundColor: bar.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Предпочитает
                </p>
                <p className="mt-0.5 text-xs text-neutral-300">{character.preferredNote}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Не форсировать
                </p>
                <p className="mt-0.5 text-xs text-neutral-300">{character.dislikedNote}</p>
              </div>
            </div>
          </Card>

          <StoryModeCard address={address} character={character} onPlayChapter={onPlayChapter} />

          {games.length > 0 && (
            <Card size="sm">
              <SectionHeading dense className="mb-2">
                Свободная игра
              </SectionHeading>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => onPlayGame(game.id)}
                    data-testid={`play-${game.id}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    <Eyebrow>{game.tagline}</Eyebrow>
                    <p className="mt-0.5 text-sm font-medium text-white">{game.title}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
