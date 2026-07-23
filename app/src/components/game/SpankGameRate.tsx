"use client";

import { useEffect, useRef, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { useEnergyRefill } from "@/hooks/useEnergyRefill";
import {
  HEAT_STAGES,
  implementsFor,
  stageForHeat,
  paceForRate,
  type GameDefinition,
} from "@/lib/games/registry";
import { spankButtonBackground } from "@/lib/games/style";
import { STORIES, resolveStoryVariant, type GameStory, type StoryBeat } from "@/lib/games/stories";
import { classifySessionQuality, type TapOutcome } from "@/lib/games/sessionQuality";
import { playTapSound, playReactionSound, playFinaleSound } from "@/lib/sound";
import { CharacterStage } from "@/components/game/CharacterStage";
import { OverrideControls } from "@/components/game/OverrideControls";
import { useCharacterHint, CharacterHintToast } from "@/components/game/CharacterHint";
import { DialogueScene } from "@/components/game/DialogueScene";
import { PageTitle, SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { applyRoundToCharacter } from "@/lib/characters/roundHook";
import { getCharacterForGame } from "@/lib/characters/registry";
import { isOverrideActive, type OverrideState } from "@/lib/characters/override";
import { loadFreshness, loadOverride, loadTraits } from "@/lib/characters/storage";
import { recordBranchChoice } from "@/lib/characters/branch";
import type { ChapterDecision, ChapterHints, DialogueTree } from "@/lib/content/types";
import {
  classifyIntensity,
  freshnessCharge,
  implementBlockReason,
  IMPLEMENT_BLOCK_MESSAGES,
  matchesTolerance,
  moodTag,
  type FreshnessState,
  type TraitState,
} from "@/lib/characters/traits";

function heatLifetimeKey(address: string, gameId: string) {
  return `kink-spank-heat-lifetime-${gameId}-${address.toLowerCase()}`;
}

function loadLifetimeHeat(address: string, gameId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(heatLifetimeKey(address, gameId)) ?? "0") || 0;
}

// Rate-based variant: cost and reward per tap both scale with how fast the
// player is currently tapping (smoothed taps/sec), instead of a flat cost.
// Going fast yields more heat per tap AND per second, but energy drains
// faster than the heat bonus grows — so speed is a real trade-off (burn
// through the energy pool quickly for a punchier scene) rather than a
// free win, and a separate "pace" reaction tracks the character's response
// to the current speed, independent from cumulative heat.
const BASE_ENERGY_COST = 1;
const ENERGY_RATE_FACTOR = 0.6;
const MAX_ENERGY_COST = 5;
const HEAT_RATE_FACTOR = 0.18;
const RATE_SMOOTHING = 0.35;
const RATE_DECAY_PER_TICK = 0.4;
const RATE_DECAY_INTERVAL_MS = 200;

type Phase = "dialogue-intro" | "intro" | "playing" | "dialogue-outro" | "finale";

export function SpankGameRate({
  address,
  game,
  titleOverride,
  storyOverride,
  nextTeaser,
  decision,
  decisionIndex,
  hints,
  introDialogue,
  outroDialogue,
  onFinishChapter,
}: {
  address: string;
  game: GameDefinition;
  titleOverride?: string;
  storyOverride?: GameStory;
  nextTeaser?: string;
  decision?: ChapterDecision;
  decisionIndex?: number;
  hints?: ChapterHints;
  introDialogue?: DialogueTree;
  outroDialogue?: DialogueTree;
  onFinishChapter?: () => void;
}) {
  const { energy, max, spend } = useEnergyContext();
  const energyRefill = useEnergyRefill();
  const [heat, setHeat] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (introDialogue ? "dialogue-intro" : "intro"));
  const [finaleBeat, setFinaleBeat] = useState<StoryBeat | null>(null);
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const implements_ = implementsFor(game);
  const character = getCharacterForGame(game.id);
  const [traits, setTraits] = useState<TraitState | null>(
    () => (character ? loadTraits(address, character) : null)
  );
  const [overrideState, setOverrideState] = useState<OverrideState | null>(
    () => (character ? loadOverride(address, character.id) : null)
  );
  const overriding = overrideState ? isOverrideActive(overrideState) : false;
  const [freshness, setFreshness] = useState<FreshnessState | null>(
    () => (character ? loadFreshness(address, character) : null)
  );
  const [selectedId, setSelectedId] = useState(implements_[0]?.id);
  const selected = implements_.find((i) => i.id === selectedId) ?? implements_[0];
  const lifetimeRef = useRef(loadLifetimeHeat(address, game.id));
  const rateRef = useRef(0);
  const lastTapRef = useRef<number | null>(null);
  const stageRef = useRef(stageForHeat(0));
  const roundStartRef = useRef(performance.now());
  const paceSumRef = useRef(0);
  const paceSamplesRef = useRef(0);
  const heatRef = useRef(0);
  // Per-tap history for THIS round only — feeds classifySessionQuality at
  // finale time (games/sessionQuality.ts). Reset in handleNewRound.
  const tapLogRef = useRef<TapOutcome[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  // storyOverride lets "chapter mode" (see chapters.ts) reuse this same
  // mechanic with a different narrative than the pilot's own default story.
  const story = storyOverride ?? STORIES[game.id];
  const { text: hintText, visible: hintVisible, triggerStage, triggerBlocked } = useCharacterHint(hints);

  const heatStage = stageForHeat((heat / game.maxHeat) * 100);
  const paceStage = paceForRate(rate);
  const outOfEnergy = energy <= 0;

  // decay the displayed pace back down when the player pauses, so "pace"
  // genuinely reflects current speed, not a monotonic peak
  useEffect(() => {
    const id = setInterval(() => {
      const idleSeconds = lastTapRef.current === null ? 999 : (performance.now() - lastTapRef.current) / 1000;
      if (idleSeconds > 0.4 && rateRef.current > 0) {
        rateRef.current = Math.max(0, rateRef.current - RATE_DECAY_PER_TICK);
        setRate(rateRef.current);
      }
    }, RATE_DECAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function handleTap() {
    if (!selected || outOfEnergy || phase !== "playing") return;
    if (traits && character && implementBlockReason(traits, character, selected, overriding)) {
      tapLogRef.current.push({ implementId: selected.id, blocked: true, matched: false, resonant: false });
      triggerBlocked();
      return;
    }

    const now = performance.now();
    if (lastTapRef.current !== null) {
      const deltaSeconds = (now - lastTapRef.current) / 1000;
      const instantRate = deltaSeconds > 0 ? Math.min(10, 1 / deltaSeconds) : 10;
      rateRef.current = rateRef.current * (1 - RATE_SMOOTHING) + instantRate * RATE_SMOOTHING;
    }
    lastTapRef.current = now;
    setRate(rateRef.current);
    paceSumRef.current += rateRef.current;
    paceSamplesRef.current += 1;

    const energyCost = Math.min(
      MAX_ENERGY_COST,
      Math.max(1, Math.round(BASE_ENERGY_COST + rateRef.current * ENERGY_RATE_FACTOR))
    );
    if (!spend(energyCost)) return;
    playTapSound();
    setPulseKey((k) => k + 1);

    tapLogRef.current.push({
      implementId: selected.id,
      blocked: false,
      matched: character ? matchesTolerance(character, classifyIntensity(selected, rateRef.current)) : true,
      resonant: character ? character.preferredImplementIds.includes(selected.id) : false,
    });

    const gained = selected.heatPerHit * (1 + rateRef.current * HEAT_RATE_FACTOR);
    // heatRef, not the `heat` state closure, is the source of truth — same
    // rapid-tap race the energy pool already hit once (see EnergyContext).
    const next = Math.min(game.maxHeat, heatRef.current + gained);
    heatRef.current = next;
    setHeat(next);
    lifetimeRef.current += gained;
    window.localStorage.setItem(heatLifetimeKey(address, game.id), String(Math.floor(lifetimeRef.current)));

    const nextStage = stageForHeat((next / game.maxHeat) * 100);
    if (nextStage.label !== stageRef.current.label) {
      stageRef.current = nextStage;
      playReactionSound();
      triggerStage(HEAT_STAGES.indexOf(nextStage));
    }

    if (next >= game.maxHeat) {
      const durationMs = now - roundStartRef.current;
      const averagePace = paceSamplesRef.current > 0 ? paceSumRef.current / paceSamplesRef.current : 0;
      const sessionQuality = classifySessionQuality(tapLogRef.current, implements_.length);
      // Mood is her disposition GOING IN to this round — see the matching
      // comment in SpankGame.tsx's finale block.
      const mood = traits ? moodTag(traits) : undefined;
      setFinaleBeat(
        resolveStoryVariant(
          story,
          game.id,
          { durationMs, implementId: selected.id, averagePace },
          mood,
          sessionQuality
        )
      );
      applyRoundToCharacter(address, game.id, selected.id, averagePace, sessionQuality);
      if (character) {
        setTraits(loadTraits(address, character));
        setOverrideState(loadOverride(address, character.id));
        setFreshness(loadFreshness(address, character));
      }
      playFinaleSound();
      setPhase(outroDialogue ? "dialogue-outro" : "finale");
    }
  }

  function handleNewRound() {
    heatRef.current = 0;
    setHeat(0);
    stageRef.current = stageForHeat(0);
    roundStartRef.current = performance.now();
    paceSumRef.current = 0;
    paceSamplesRef.current = 0;
    rateRef.current = 0;
    setRate(0);
    lastTapRef.current = null;
    tapLogRef.current = [];
    setPickedOptionId(null);
    setPhase("playing");
  }

  const heatPercent = (heat / game.maxHeat) * 100;

  return (
    <div className="relative flex w-full min-h-0 flex-1 flex-col lg:flex-row">
      <CharacterHintToast text={hintText} visible={hintVisible} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8">
        <div>
          <Eyebrow>{game.tagline}</Eyebrow>
          <PageTitle as="h2" plain>
            {titleOverride ?? game.title}
          </PageTitle>
        </div>

        <CharacterStage
          color={heatStage.color}
          label={phase === "finale" ? "Кульминация" : heatStage.label}
          caption={game.characterLabel}
          pulseKey={pulseKey}
        />

        <Card size="sm">
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${heatPercent}%`, backgroundColor: heatStage.color }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {Math.round(heat)} / {game.maxHeat}
          </p>

          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-xs text-neutral-400">Темп</p>
            <p className="text-sm font-semibold text-indigo-300" data-testid="pace-label">
              {phase === "finale" ? "—" : paceStage.label}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all duration-150"
                style={{ width: `${Math.min(100, (rate / 6) * 100)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex w-full flex-col gap-4 border-t border-white/10 bg-white/[0.03] p-4 lg:w-80 lg:border-t-0 lg:border-l lg:p-6">
        <button
          onClick={handleTap}
          disabled={outOfEnergy || phase !== "playing"}
          data-testid="spank-button"
          className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-white/10 text-lg font-semibold text-white shadow-2xl transition active:scale-95 disabled:opacity-40 lg:h-40 lg:w-40"
          style={{ background: spankButtonBackground(selected?.color) }}
        >
          {outOfEnergy ? "Нет энергии" : "Шлёп"}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {implements_.map((impl) => {
            const reason = traits && character ? implementBlockReason(traits, character, impl, overriding) : null;
            const blocked = reason !== null;
            const charge = freshness ? freshnessCharge(freshness, impl.id) : 100;
            return (
              <button
                key={impl.id}
                onClick={() => !blocked && setSelectedId(impl.id)}
                disabled={blocked}
                data-testid={`implement-${impl.id}`}
                title={reason ? IMPLEMENT_BLOCK_MESSAGES[reason] : undefined}
                className={`flex h-16 w-20 flex-col items-center justify-center rounded-xl border text-xs font-medium transition ${
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
                <span
                  className="mt-1 h-1 w-10 overflow-hidden rounded-full bg-white/10"
                  title={`Свежесть: ${Math.round(charge)}%`}
                >
                  <span
                    className="block h-full rounded-full transition-all"
                    style={{ width: `${charge}%`, backgroundColor: impl.color }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
          <span className="text-neutral-400" data-testid="energy-readout">
            Энергия: {energy}/{max}
          </span>
          {outOfEnergy && (
            <Button
              onClick={energyRefill.buyRefill}
              disabled={energyRefill.pending}
              data-testid="refill-button"
              size="sm"
            >
              {energyRefill.pending ? "…" : `Пополнить (${energyRefill.cost} монет)`}
            </Button>
          )}
        </div>
        {energyRefill.error && (
          <p className="text-xs text-rose-400" data-testid="refill-error">
            {energyRefill.error}
          </p>
        )}

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

      {phase === "dialogue-intro" && introDialogue && (
        <DialogueScene
          tree={introDialogue}
          accentColor={character?.accentColor}
          onComplete={() => setPhase("intro")}
        />
      )}

      {phase === "dialogue-outro" && outroDialogue && (
        <DialogueScene
          tree={outroDialogue}
          accentColor={character?.accentColor}
          onComplete={() => setPhase("finale")}
        />
      )}

      {phase === "intro" && story && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <Card size="lg" className="max-w-md text-center">
            {story.intro.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={story.intro.image}
                alt=""
                className="mb-3 h-40 w-full rounded-xl object-cover"
              />
            )}
            <Eyebrow>{titleOverride ?? game.title}</Eyebrow>
            <p className="mt-3 text-sm leading-relaxed text-neutral-200" data-testid="story-intro">
              {story.intro.text}
            </p>
            <Button onClick={() => setPhase("playing")} data-testid="story-start-button" size="lg" className="mt-5">
              Начать
            </Button>
          </Card>
        </div>
      )}

      {phase === "finale" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <Card size="lg" className="max-w-md text-center">
            {finaleBeat?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={finaleBeat.image}
                alt=""
                className="mb-3 h-40 w-full rounded-xl object-cover"
              />
            )}
            <SectionHeading dense>Кульминация</SectionHeading>
            <p className="mt-3 text-sm leading-relaxed text-neutral-200" data-testid="story-finale">
              {finaleBeat?.text}
            </p>
            {nextTeaser && (
              <p
                className="mt-4 border-t border-white/10 pt-4 text-sm italic leading-relaxed text-indigo-200"
                data-testid="next-teaser"
              >
                {nextTeaser}
              </p>
            )}

            {decision && (
              <div className="mt-4 border-t border-white/10 pt-4">
                {pickedOptionId === null ? (
                  <>
                    <p className="text-sm leading-relaxed text-neutral-200" data-testid="decision-prompt">
                      {decision.prompt.text}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {decision.options.map((option) => (
                        <Button
                          key={option.id}
                          variant="secondary"
                          onClick={() => {
                            if (character) {
                              recordBranchChoice(address, character.id, decisionIndex ?? 0, option.id);
                            }
                            setPickedOptionId(option.id);
                          }}
                          data-testid={`decision-option-${option.id}`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-indigo-200" data-testid="decision-result">
                    {decision.options.find((o) => o.id === pickedOptionId)?.result.text}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-neutral-500">
              Прогресс в «Отклике» уже сохранён.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {onFinishChapter && (
                <Button onClick={onFinishChapter} data-testid="finish-chapter-button" size="lg">
                  Дальше →
                </Button>
              )}
              <Button
                onClick={handleNewRound}
                data-testid="new-round-button"
                size="lg"
                variant={onFinishChapter ? "secondary" : "primary"}
              >
                Новый раунд
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
