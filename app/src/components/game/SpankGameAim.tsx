"use client";

import { useEffect, useRef, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { useEnergyRefill } from "@/hooks/useEnergyRefill";
import { HEAT_STAGES, implementsFor, stageForHeat, type GameDefinition } from "@/lib/games/registry";
import { STORIES, type GameStory, type StoryBeat } from "@/lib/games/stories";
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
import { loadFreshness, loadOverride, loadTraits, saveTraits } from "@/lib/characters/storage";
import { recordBranchChoice } from "@/lib/characters/branch";
import type { ChapterDecision, ChapterHints, DialogueTree } from "@/lib/content/types";
import {
  applyAimFailPenalty,
  applyAimSuccessBonus,
  freshnessCharge,
  implementBlockReason,
  IMPLEMENT_BLOCK_MESSAGES,
  moodTag,
  type FreshnessState,
  type TraitState,
} from "@/lib/characters/traits";

// She shifts between these three positions on her own timer — landing a hit
// on whichever one she's CURRENTLY in is the whole game; the other two are
// still clickable (so a wrong guess costs a real, immediate tap), just far
// less effective. Clicked directly on her portrait (three equal columns
// overlaid on CharacterStage) rather than as separate buttons off to the
// side — see the zone overlay in the JSX below.
type ZoneId = "left" | "center" | "right";
const ZONES: { id: ZoneId; label: string }[] = [
  { id: "left", label: "Левее" },
  { id: "center", label: "Центр" },
  { id: "right", label: "Правее" },
];

// Base cycle speed — scaled down (harder) by her CURRENT boredom at round
// start (see zoneSwitchMs below): the more neglected she's been, the less
// patient she is about being read correctly. Never scales below the floor —
// a restless read is still meant to be beatable, not impossible.
const ZONE_SWITCH_MS_BASE = 1700;
const ZONE_SWITCH_MS_FLOOR = 900;
const BOREDOM_SPEED_MS_PER_POINT = 8;
const ZONE_HIT_MULTIPLIER = 1.15;
const ZONE_MISS_MULTIPLIER = 0.45;

// Consecutive correct reads build a small bonus, capped — rewards patient,
// attentive play over rushing/guessing. Resets to zero on any miss.
const STREAK_BONUS_PER_HIT = 0.05;
const STREAK_CAP = 6;

// Her own preferredImplementIds (characters/registry.ts) lands harder here
// too, not just in the background trait economy — landing a hit with her
// favourite implement gets its own distinct flash.
const PREFERRED_HIT_BONUS = 1.15;

// Repeating the same implement tap after tap dulls the scene (her own
// traitNotes say as much: "повторение одного приёма подряд быстро
// остужает") — a decaying novelty multiplier that only recovers when the
// player actually switches implements.
const NOVELTY_FLOOR = 0.7;
const NOVELTY_DECAY_PER_TAP = 0.03;

// A "flinch" meter, seeded from her real persisted Defiance and rising
// with every miss (falling fast on a hit — same fast-flares/fast-cools
// pattern Defiance already has, see traits.ts's DEFIANCE_COOLDOWN_PER_HOUR).
// Crossing the threshold has her pull back from one zone entirely for a
// few seconds — a rushed guess reads as rushing HER, not just missing.
const MISS_FLINCH_GAIN = 15;
const HIT_FLINCH_RELIEF = 8;
const FLINCH_LOCKOUT_THRESHOLD = 60;
const FLINCH_RELIEF_ON_TRIGGER = 30;
const LOCKOUT_DURATION_MS = 2500;

const MOOD_LABEL: Record<"warm" | "cold", string> = { warm: "Тепло", cold: "Настороже" };

function randomZone(exclude?: ZoneId, alsoExclude?: ZoneId | null): ZoneId {
  const options = ZONES.map((z) => z.id).filter((id) => id !== exclude && id !== alsoExclude);
  return options[Math.floor(Math.random() * options.length)] ?? ZONES[0].id;
}

// The round is a fixed 60-second skill check, not a race to a heat total —
// precision (hits / taps) at the buzzer decides which of the two finale
// texts plays and which trait function fires (traits.ts). A minimum tap
// count keeps a lucky single tap from counting as a "pass".
const ROUND_DURATION_MS = 60_000;
const SUCCESS_PRECISION = 0.65;
const MIN_TAPS_FOR_SUCCESS = 8;
const TICK_MS = 200;

const SUCCESS_BEAT: StoryBeat = {
  text: "Она сама не заметила, как перестала следить за тем, куда именно вы метите — просто расслабилась и позволила руке, которая ни разу не промахнулась, вести дальше.",
};
const FAIL_BEAT: StoryBeat = {
  text: "Она честно пыталась угадать, куда вы метите в следующий раз — и почти всегда оказывалась не там. К концу минуты уже сама смеётся над тем, как редко вы сходились.",
};

function heatLifetimeKey(address: string, gameId: string) {
  return `kink-spank-heat-lifetime-${gameId}-${address.toLowerCase()}`;
}

function loadLifetimeHeat(address: string, gameId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(heatLifetimeKey(address, gameId)) ?? "0") || 0;
}

// "choosing" sits between the intro card and the actual round: the timer
// and zone cycling both stay dormant (see their effects below) until the
// player picks an implement, so the minute never burns down before they've
// even decided what to use.
type Phase = "dialogue-intro" | "intro" | "choosing" | "playing" | "dialogue-outro" | "finale";

export function SpankGameAim({
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
  const { energy, spend } = useEnergyContext();
  const energyRefill = useEnergyRefill();
  const [phase, setPhase] = useState<Phase>(() => (introDialogue ? "dialogue-intro" : "intro"));
  const [finaleBeat, setFinaleBeat] = useState<StoryBeat | null>(null);
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null);
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
  const stageRef = useRef(stageForHeat(0));
  const roundStartRef = useRef(performance.now());
  const [pulseKey, setPulseKey] = useState(0);
  const story = storyOverride ?? STORIES[game.id];
  const { text: hintText, visible: hintVisible, triggerStage, triggerBlocked } = useCharacterHint(hints);

  const [activeZone, setActiveZone] = useState<ZoneId>(() => randomZone());
  const [lastZoneResult, setLastZoneResult] = useState<"hit" | "preferred" | "miss" | null>(null);
  const zoneHitsRef = useRef(0);
  const zoneTapsRef = useRef(0);
  // Without the old maxHeat cap, a timed round can rack up far more taps
  // than a heat-race round ever could — this caps how much of that a single
  // round can feed into the lifetime/affinity counter, so this pilot's pace
  // stays in line with the capped ones instead of inflating "Отклик" faster
  // than everything else.
  const roundGainedRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const finishedRef = useRef(false);
  // Always points at the CURRENT render's finishRound (closing over this
  // render's precision/selected/traits) — the countdown timer below reads
  // through this ref instead of calling finishRound directly, since its own
  // effect only re-subscribes on `phase` and would otherwise fire a
  // finishRound frozen from the very start of the round (precision still 0).
  const finishRoundRef = useRef<() => void>(() => {});

  const hitStreakRef = useRef(0);
  const lastImplementRef = useRef<string | null>(null);
  const sameImplementStreakRef = useRef(0);
  const [streak, setStreak] = useState(0);
  const flinchRef = useRef(traits?.defiance ?? 0);
  const [closedZone, setClosedZone] = useState<ZoneId | null>(null);
  const closedZoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Faster the more bored she already is going into this round — read from
  // whatever traits were loaded at mount/last finale, not live (traits only
  // change between rounds, not mid-round).
  const zoneSwitchMs = Math.max(
    ZONE_SWITCH_MS_FLOOR,
    ZONE_SWITCH_MS_BASE - (traits?.boredom ?? 0) * BOREDOM_SPEED_MS_PER_POINT
  );

  // Zone cycling — only while the round is actually running. Restarts (and
  // re-picks) whenever the lockout toggles so a newly-closed zone can never
  // linger as the "active" one, and vice versa.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      setActiveZone((current) => randomZone(current, closedZone));
    }, zoneSwitchMs);
    return () => clearInterval(id);
  }, [phase, zoneSwitchMs, closedZone]);

  useEffect(() => {
    return () => {
      if (closedZoneTimerRef.current) clearTimeout(closedZoneTimerRef.current);
    };
  }, []);

  // The 60-second countdown itself — ticks off elapsed real time rather
  // than a fixed decrement, so background-tab throttling can't stretch the
  // round out past a minute.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const elapsed = performance.now() - roundStartRef.current;
      const left = Math.max(0, ROUND_DURATION_MS - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) finishRoundRef.current();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const outOfEnergy = energy <= 0;
  const precision = zoneTapsRef.current > 0 ? zoneHitsRef.current / zoneTapsRef.current : 0;
  // Her visible reaction tracks how well the round is going right now, not
  // a heat total — same 5-tier palette as every other pilot, just fed by
  // live precision instead of accumulated hits.
  const stage = stageForHeat(precision * 100);
  const mood = traits ? moodTag(traits) : "warm";

  function finishRound() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Recomputed fresh from the refs (not the `precision` closure variable)
    // so this always reflects the actual final tally, however long ago this
    // particular closure was created — see finishRoundRef above.
    const finalPrecision = zoneTapsRef.current > 0 ? zoneHitsRef.current / zoneTapsRef.current : 0;
    const success = zoneTapsRef.current >= MIN_TAPS_FOR_SUCCESS && finalPrecision >= SUCCESS_PRECISION;
    setFinaleBeat(success ? SUCCESS_BEAT : FAIL_BEAT);

    if (selected) {
      applyRoundToCharacter(address, game.id, selected.id, 0, "neutral");
    }
    if (character) {
      // Re-read rather than reuse the pre-round `traits` state — the
      // applyRoundToCharacter call above already computed and persisted its
      // own implement-based relief, and stacking the aim bonus/penalty on
      // the stale value would silently overwrite that with just this delta.
      const afterImplement = loadTraits(address, character);
      const updated = success ? applyAimSuccessBonus(afterImplement) : applyAimFailPenalty(afterImplement);
      saveTraits(address, character.id, updated);
      setTraits(updated);
      setOverrideState(loadOverride(address, character.id));
      setFreshness(loadFreshness(address, character));
    }
    playFinaleSound();
    setPhase(outroDialogue ? "dialogue-outro" : "finale");
  }
  finishRoundRef.current = finishRound;

  function triggerFlinchLockout() {
    if (closedZone) return; // don't stack a second lockout while one's active
    const candidates = ZONES.map((z) => z.id).filter((id) => id !== activeZone);
    const lockZone = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    if (!lockZone) return;
    setClosedZone(lockZone);
    flinchRef.current = Math.max(0, flinchRef.current - FLINCH_RELIEF_ON_TRIGGER);
    if (closedZoneTimerRef.current) clearTimeout(closedZoneTimerRef.current);
    closedZoneTimerRef.current = setTimeout(() => setClosedZone(null), LOCKOUT_DURATION_MS);
  }

  function handleZoneTap(zoneId: ZoneId) {
    if (!selected || outOfEnergy || phase !== "playing" || zoneId === closedZone) return;
    if (traits && character && implementBlockReason(traits, character, selected, overriding)) {
      triggerBlocked();
      return;
    }
    if (!spend(1)) return;
    playTapSound();
    setPulseKey((k) => k + 1);

    const isHit = zoneId === activeZone;
    zoneTapsRef.current += 1;
    if (isHit) zoneHitsRef.current += 1;

    // Same-implement repetition dulls the multiplier regardless of hit/miss
    // — matches her own traitNotes on repetition ("быстро остужает").
    const isSameImplement = selected.id === lastImplementRef.current;
    sameImplementStreakRef.current = isSameImplement ? sameImplementStreakRef.current + 1 : 0;
    lastImplementRef.current = selected.id;
    const noveltyMultiplier = Math.max(
      NOVELTY_FLOOR,
      1 - sameImplementStreakRef.current * NOVELTY_DECAY_PER_TAP
    );

    let multiplier = ZONE_MISS_MULTIPLIER;
    let result: "hit" | "preferred" | "miss" = "miss";
    if (isHit) {
      hitStreakRef.current += 1;
      flinchRef.current = Math.max(0, flinchRef.current - HIT_FLINCH_RELIEF);
      const preferred = Boolean(character?.preferredImplementIds.includes(selected.id));
      multiplier = ZONE_HIT_MULTIPLIER * (1 + Math.min(hitStreakRef.current, STREAK_CAP) * STREAK_BONUS_PER_HIT);
      if (preferred) multiplier *= PREFERRED_HIT_BONUS;
      result = preferred ? "preferred" : "hit";
    } else {
      hitStreakRef.current = 0;
      flinchRef.current = Math.min(100, flinchRef.current + MISS_FLINCH_GAIN);
      if (flinchRef.current >= FLINCH_LOCKOUT_THRESHOLD) triggerFlinchLockout();
    }
    setStreak(hitStreakRef.current);
    setLastZoneResult(result);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setLastZoneResult(null), 700);

    const gained = selected.heatPerHit * multiplier * noveltyMultiplier;
    const affinityRemaining = Math.max(0, game.maxHeat - roundGainedRef.current);
    const affinityGain = Math.min(gained, affinityRemaining);
    roundGainedRef.current += affinityGain;
    lifetimeRef.current += affinityGain;
    window.localStorage.setItem(heatLifetimeKey(address, game.id), String(lifetimeRef.current));

    const nextPrecision = zoneHitsRef.current / zoneTapsRef.current;
    const nextStage = stageForHeat(nextPrecision * 100);
    if (nextStage.label !== stageRef.current.label) {
      stageRef.current = nextStage;
      playReactionSound();
      triggerStage(HEAT_STAGES.indexOf(nextStage));
    }
  }

  // Resets every round-scoped counter and drops into "choosing" — the timer
  // and zone cycling both wait there (see their effects above) until
  // confirmImplementAndStart actually kicks the round off.
  function resetRoundState() {
    stageRef.current = stageForHeat(0);
    zoneHitsRef.current = 0;
    zoneTapsRef.current = 0;
    roundGainedRef.current = 0;
    hitStreakRef.current = 0;
    sameImplementStreakRef.current = 0;
    // Not pre-seeded to the current selection — the first tap of a round
    // should never register as a "repeat" of nothing.
    lastImplementRef.current = null;
    flinchRef.current = traits?.defiance ?? 0;
    if (closedZoneTimerRef.current) clearTimeout(closedZoneTimerRef.current);
    setClosedZone(null);
    setStreak(0);
    finishedRef.current = false;
    setTimeLeftMs(ROUND_DURATION_MS);
    setLastZoneResult(null);
    setActiveZone(randomZone());
    setPickedOptionId(null);
  }

  function handleNewRound() {
    resetRoundState();
    setPhase("choosing");
  }

  // The actual moment the minute starts — picking (or confirming) an
  // implement while "choosing" is what kicks the timer and zone cycling off,
  // not the "Начать" button itself.
  function confirmImplementAndStart(implementId: string) {
    setSelectedId(implementId);
    if (phase !== "choosing") return;
    roundStartRef.current = performance.now();
    setActiveZone(randomZone());
    setPhase("playing");
  }

  const precisionPercent = Math.round(precision * 100);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const timePercent = (timeLeftMs / ROUND_DURATION_MS) * 100;

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

        <div className="relative flex flex-1">
          <CharacterStage
            color={stage.color}
            label={phase === "finale" ? "Кульминация" : stage.label}
            caption={game.characterLabel}
            pulseKey={pulseKey}
          />

          {phase === "choosing" && (
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur"
              data-testid="aim-choose-hint"
            >
              Выберите инструмент, чтобы начать
            </span>
          )}

          {phase === "playing" && (
            <>
              <div className="pointer-events-none absolute inset-0 flex">
                {ZONES.map((zone) => {
                  const isClosed = zone.id === closedZone;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => handleZoneTap(zone.id)}
                      disabled={outOfEnergy || isClosed}
                      data-testid={`aim-zone-${zone.id}`}
                      aria-label={zone.label}
                      className={`pointer-events-auto flex-1 border-white/5 transition first:border-r last:border-l disabled:cursor-not-allowed ${
                        isClosed
                          ? "bg-black/40"
                          : zone.id === activeZone
                            ? "bg-fuchsia-500/10 ring-2 ring-inset ring-fuchsia-400/50"
                            : "hover:bg-white/5"
                      }`}
                    />
                  );
                })}
              </div>
              <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5">
                <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  Она здесь: {ZONES.find((z) => z.id === activeZone)?.label}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur ${
                    mood === "warm"
                      ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                      : "border-indigo-400/30 bg-indigo-500/10 text-indigo-200"
                  }`}
                  data-testid="aim-mood"
                >
                  {MOOD_LABEL[mood]}
                </span>
              </div>
              {closedZone && (
                <span
                  className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-200 backdrop-blur"
                  data-testid="aim-flinch"
                >
                  Она отстранилась — не спешите
                </span>
              )}
              {streak >= 1 && (
                <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  Серия: {streak}
                </span>
              )}
              {lastZoneResult && (
                <span
                  className={`pointer-events-none absolute right-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${
                    lastZoneResult === "preferred"
                      ? "border-pink-400/40 bg-pink-500/20 text-pink-200"
                      : lastZoneResult === "hit"
                        ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                        : "border-white/10 bg-black/50 text-neutral-400"
                  }`}
                  data-testid="aim-feedback"
                >
                  {lastZoneResult === "preferred" ? "Ей особенно нравится!" : lastZoneResult === "hit" ? "Точно!" : "Мимо…"}
                </span>
              )}
            </>
          )}
        </div>

        <Card size="sm">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Осталось времени</span>
            <span className="tabular-nums" data-testid="aim-timer">
              {secondsLeft}с
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all duration-200"
              style={{ width: `${timePercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Нужно {Math.round(SUCCESS_PRECISION * 100)}% попаданий, чтобы она осталась довольна
            </p>
            <p className="text-xs text-neutral-500" data-testid="aim-precision">
              Точность: {precisionPercent}%
            </p>
          </div>
        </Card>
      </div>

      <div className="flex w-full flex-col gap-4 border-t border-white/10 bg-white/[0.03] p-4 lg:w-80 lg:border-t-0 lg:border-l lg:p-6">
        <div className="grid grid-cols-1 gap-3">
          {implements_.map((impl) => {
            const reason = traits && character ? implementBlockReason(traits, character, impl, overriding) : null;
            const blocked = reason !== null;
            const charge = freshness ? freshnessCharge(freshness, impl.id) : 100;
            return (
              <button
                key={impl.id}
                onClick={() => !blocked && confirmImplementAndStart(impl.id)}
                disabled={blocked}
                data-testid={`implement-${impl.id}`}
                title={reason ? IMPLEMENT_BLOCK_MESSAGES[reason] : undefined}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
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
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-neutral-500"
                  style={{ backgroundColor: `${impl.color}22` }}
                >
                  фото
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">{impl.name}</span>
                  <span
                    className="h-1 w-full overflow-hidden rounded-full bg-white/10"
                    title={`Свежесть: ${Math.round(charge)}%`}
                  >
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{ width: `${charge}%`, backgroundColor: impl.color }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {outOfEnergy && (
          <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
            <span className="text-neutral-400">Энергия закончилась</span>
            <Button onClick={energyRefill.buyRefill} disabled={energyRefill.pending} data-testid="refill-button" size="sm">
              {energyRefill.pending ? "…" : `Пополнить (${energyRefill.cost} монет)`}
            </Button>
            {energyRefill.error && (
              <p className="text-xs text-rose-400" data-testid="refill-error">
                {energyRefill.error}
              </p>
            )}
          </div>
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
            <p className="mt-3 text-xs text-neutral-500">
              У вас минута. Она будет смещаться между тремя положениями — бейте туда, где она сейчас, и держите{" "}
              {Math.round(SUCCESS_PRECISION * 100)}% точности. Минута начнётся, как только выберете инструмент.
            </p>
            <Button
              onClick={() => {
                resetRoundState();
                setPhase("choosing");
              }}
              data-testid="story-start-button"
              size="lg"
              className="mt-5"
            >
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
            <p className="mt-2 text-xs text-neutral-500">Точность за раунд: {precisionPercent}%</p>
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
