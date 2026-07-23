"use client";

import { useRef, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { implementsFor, stageForHeat, type GameDefinition } from "@/lib/games/registry";
import { STORIES, resolveStoryVariant, type GameStory } from "@/lib/games/stories";
import { playTapSound, playReactionSound, playFinaleSound } from "@/lib/sound";
import { CharacterStage } from "@/components/game/CharacterStage";
import { OverrideControls } from "@/components/game/OverrideControls";
import { applyRoundToCharacter } from "@/lib/characters/roundHook";
import { getCharacterForGame } from "@/lib/characters/registry";
import { isOverrideActive, type OverrideState } from "@/lib/characters/override";
import { loadOverride, loadTraits } from "@/lib/characters/storage";
import { isImplementBlocked, type TraitState } from "@/lib/characters/traits";

function heatLifetimeKey(address: string, gameId: string) {
  return `kink-spank-heat-lifetime-${gameId}-${address.toLowerCase()}`;
}

function loadLifetimeHeat(address: string, gameId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(heatLifetimeKey(address, gameId)) ?? "0") || 0;
}

type Phase = "intro" | "playing" | "finale";

export function SpankGame({
  address,
  game,
  titleOverride,
  storyOverride,
  nextTeaser,
}: {
  address: string;
  game: GameDefinition;
  titleOverride?: string;
  storyOverride?: GameStory;
  nextTeaser?: string;
}) {
  const { energy, max, spend, refill } = useEnergyContext();
  const [heat, setHeat] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [finaleText, setFinaleText] = useState("");
  const implements_ = implementsFor(game);
  const character = getCharacterForGame(game.id);
  const [traits, setTraits] = useState<TraitState | null>(
    () => (character ? loadTraits(address, character) : null)
  );
  const [overrideState, setOverrideState] = useState<OverrideState | null>(
    () => (character ? loadOverride(address, character.id) : null)
  );
  const overriding = overrideState ? isOverrideActive(overrideState) : false;
  const [selectedId, setSelectedId] = useState(implements_[0]?.id);
  const selected = implements_.find((i) => i.id === selectedId) ?? implements_[0];
  const lifetimeRef = useRef(loadLifetimeHeat(address, game.id));
  const stageRef = useRef(stageForHeat(0));
  const roundStartRef = useRef(performance.now());
  const heatRef = useRef(0);
  const [pulseKey, setPulseKey] = useState(0);
  // storyOverride lets "chapter mode" (see chapters.ts) reuse this same
  // mechanic with a different narrative than the pilot's own default story.
  const story = storyOverride ?? STORIES[game.id];

  const stage = stageForHeat((heat / game.maxHeat) * 100);
  const outOfEnergy = energy <= 0;

  function handleTap() {
    if (!selected || outOfEnergy || phase !== "playing") return;
    if (traits && character && isImplementBlocked(traits, character, selected, overriding)) return;
    if (!spend(1)) return;
    playTapSound();
    setPulseKey((k) => k + 1);

    const gained = selected.heatPerHit;
    // heatRef (not the `heat` state closure) is the source of truth so a
    // burst of synchronous taps in one tick each read the up-to-date value
    // instead of stacking on a stale render's number — same fix as the
    // energy-desync bug this project already hit once (see EnergyContext).
    const next = Math.min(game.maxHeat, heatRef.current + gained);
    heatRef.current = next;
    setHeat(next);
    lifetimeRef.current += gained;
    window.localStorage.setItem(heatLifetimeKey(address, game.id), String(lifetimeRef.current));

    const nextStage = stageForHeat((next / game.maxHeat) * 100);
    if (nextStage.label !== stageRef.current.label) {
      stageRef.current = nextStage;
      playReactionSound();
    }

    if (next >= game.maxHeat) {
      const durationMs = performance.now() - roundStartRef.current;
      setFinaleText(
        resolveStoryVariant(game.id, {
          durationMs,
          implementId: selected.id,
          averagePace: 0,
        })
      );
      applyRoundToCharacter(address, game.id, selected.id, 0);
      if (character) {
        setTraits(loadTraits(address, character));
        setOverrideState(loadOverride(address, character.id));
      }
      playFinaleSound();
      setPhase("finale");
    }
  }

  function handleNewRound() {
    heatRef.current = 0;
    setHeat(0);
    stageRef.current = stageForHeat(0);
    roundStartRef.current = performance.now();
    setPhase("playing");
  }

  const heatPercent = (heat / game.maxHeat) * 100;

  return (
    <div className="relative flex w-full min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
            {game.tagline}
          </p>
          <h1 className="text-xl font-bold text-white lg:text-2xl">{titleOverride ?? game.title}</h1>
        </div>

        <CharacterStage
          color={stage.color}
          label={phase === "finale" ? "Кульминация" : stage.label}
          caption={game.characterLabel}
          pulseKey={pulseKey}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/30 backdrop-blur-2xl">
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${heatPercent}%`, backgroundColor: stage.color }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {Math.round(heat)} / {game.maxHeat}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 border-t border-white/10 bg-white/[0.03] p-4 lg:w-80 lg:border-t-0 lg:border-l lg:p-6">
        <button
          onClick={handleTap}
          disabled={outOfEnergy || phase !== "playing"}
          data-testid="spank-button"
          className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-white/10 text-lg font-semibold text-white shadow-2xl transition active:scale-95 disabled:opacity-40 lg:h-40 lg:w-40"
          style={{
            background: selected
              ? `linear-gradient(135deg, ${selected.color}, #6366f1)`
              : "#333",
          }}
        >
          {outOfEnergy ? "Нет энергии" : "Шлёп"}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {implements_.map((impl) => {
            const blocked = traits && character ? isImplementBlocked(traits, character, impl, overriding) : false;
            return (
              <button
                key={impl.id}
                onClick={() => !blocked && setSelectedId(impl.id)}
                disabled={blocked}
                data-testid={`implement-${impl.id}`}
                title={blocked ? "Недоступно — слишком высокая дерзость" : undefined}
                className={`flex h-14 w-20 flex-col items-center justify-center rounded-lg border text-[11px] font-medium transition ${
                  blocked
                    ? "cursor-not-allowed border-white/5 bg-white/[0.01] text-neutral-600 opacity-50"
                    : selectedId === impl.id
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20"
                }`}
                style={{
                  boxShadow: !blocked && selectedId === impl.id ? `0 0 0 1px ${impl.color}` : undefined,
                }}
              >
                <span className="mb-1 h-3 w-3 rounded-sm" style={{ backgroundColor: impl.color }} />
                {impl.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
          <span className="text-neutral-400" data-testid="energy-readout">
            Энергия: {energy}/{max}
          </span>
          {outOfEnergy && (
            <button
              onClick={refill}
              data-testid="refill-button"
              className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white"
            >
              Пополнить
            </button>
          )}
        </div>

        {character && overrideState && (
          <OverrideControls
            address={address}
            character={character}
            state={overrideState}
            onChange={(next) => {
              setOverrideState(next);
              setTraits(loadTraits(address, character));
            }}
          />
        )}
      </div>

      {phase === "intro" && story && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
              {titleOverride ?? game.title}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-200" data-testid="story-intro">
              {story.intro}
            </p>
            <button
              onClick={() => setPhase("playing")}
              data-testid="story-start-button"
              className="mt-5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
            >
              Начать
            </button>
          </div>
        </div>
      )}

      {phase === "finale" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <p className="text-sm font-semibold text-white">Кульминация</p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-200" data-testid="story-finale">
              {finaleText}
            </p>
            {nextTeaser && (
              <p
                className="mt-4 border-t border-white/10 pt-4 text-sm italic leading-relaxed text-indigo-200"
                data-testid="next-teaser"
              >
                {nextTeaser}
              </p>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              Прогресс в «Отклике» уже сохранён.
            </p>
            <button
              onClick={handleNewRound}
              data-testid="new-round-button"
              className="mt-5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
            >
              Новый раунд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
