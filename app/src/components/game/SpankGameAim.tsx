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

const ZONE_SWITCH_MS = 1700;
const ZONE_HIT_MULTIPLIER = 1.15;
const ZONE_MISS_MULTIPLIER = 0.45;

function randomZone(exclude?: ZoneId): ZoneId {
  const options = ZONES.map((z) => z.id).filter((id) => id !== exclude);
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

type Phase = "dialogue-intro" | "intro" | "playing" | "dialogue-outro" | "finale";

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
  const [lastZoneResult, setLastZoneResult] = useState<"hit" | "miss" | null>(null);
  const zoneHitsRef = useRef(0);
  const zoneTapsRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const finishedRef = useRef(false);

  // Zone cycling — only while the round is actually running.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      setActiveZone((current) => randomZone(current));
    }, ZONE_SWITCH_MS);
    return () => clearInterval(id);
  }, [phase]);

  // The 60-second countdown itself — ticks off elapsed real time rather
  // than a fixed decrement, so background-tab throttling can't stretch the
  // round out past a minute.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const elapsed = performance.now() - roundStartRef.current;
      const left = Math.max(0, ROUND_DURATION_MS - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) finishRound();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function finishRound() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const success = zoneTapsRef.current >= MIN_TAPS_FOR_SUCCESS && precision >= SUCCESS_PRECISION;
    setFinaleBeat(success ? SUCCESS_BEAT : FAIL_BEAT);

    if (selected) {
      applyRoundToCharacter(address, game.id, selected.id, 0, "neutral");
    }
    if (character && traits) {
      const updated = success ? applyAimSuccessBonus(traits) : applyAimFailPenalty(traits);
      saveTraits(address, character.id, updated);
      setTraits(updated);
      setOverrideState(loadOverride(address, character.id));
      setFreshness(loadFreshness(address, character));
    }
    playFinaleSound();
    setPhase(outroDialogue ? "dialogue-outro" : "finale");
  }

  function handleZoneTap(zoneId: ZoneId) {
    if (!selected || outOfEnergy || phase !== "playing") return;
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
    setLastZoneResult(isHit ? "hit" : "miss");
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setLastZoneResult(null), 700);

    const gained = selected.heatPerHit * (isHit ? ZONE_HIT_MULTIPLIER : ZONE_MISS_MULTIPLIER);
    lifetimeRef.current += gained;
    window.localStorage.setItem(heatLifetimeKey(address, game.id), String(lifetimeRef.current));

    const nextPrecision = zoneHitsRef.current / zoneTapsRef.current;
    const nextStage = stageForHeat(nextPrecision * 100);
    if (nextStage.label !== stageRef.current.label) {
      stageRef.current = nextStage;
      playReactionSound();
      triggerStage(HEAT_STAGES.indexOf(nextStage));
    }
  }

  function handleNewRound() {
    stageRef.current = stageForHeat(0);
    roundStartRef.current = performance.now();
    zoneHitsRef.current = 0;
    zoneTapsRef.current = 0;
    finishedRef.current = false;
    setTimeLeftMs(ROUND_DURATION_MS);
    setLastZoneResult(null);
    setActiveZone(randomZone());
    setPickedOptionId(null);
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

        <div className="relative flex-1">
          <CharacterStage
            color={stage.color}
            label={phase === "finale" ? "Кульминация" : stage.label}
            caption={game.characterLabel}
            pulseKey={pulseKey}
          />

          {phase === "playing" && (
            <>
              <div className="pointer-events-none absolute inset-0 flex">
                {ZONES.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => handleZoneTap(zone.id)}
                    disabled={outOfEnergy}
                    data-testid={`aim-zone-${zone.id}`}
                    aria-label={zone.label}
                    className={`pointer-events-auto flex-1 border-white/5 transition first:border-r last:border-l disabled:cursor-not-allowed ${
                      zone.id === activeZone
                        ? "bg-fuchsia-500/10 ring-2 ring-inset ring-fuchsia-400/50"
                        : "hover:bg-white/5"
                    }`}
                  />
                ))}
              </div>
              <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                Она здесь: {ZONES.find((z) => z.id === activeZone)?.label}
              </span>
              {lastZoneResult && (
                <span
                  className={`pointer-events-none absolute right-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${
                    lastZoneResult === "hit"
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                      : "border-white/10 bg-black/50 text-neutral-400"
                  }`}
                  data-testid="aim-feedback"
                >
                  {lastZoneResult === "hit" ? "Точно!" : "Мимо…"}
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
                onClick={() => !blocked && setSelectedId(impl.id)}
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
              {Math.round(SUCCESS_PRECISION * 100)}% точности.
            </p>
            <Button
              onClick={() => {
                roundStartRef.current = performance.now();
                setPhase("playing");
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
