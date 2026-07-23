"use client";

import { useEffect, useRef, useState } from "react";
import { useEnergyContext } from "@/contexts/EnergyContext";
import { useEnergyRefill } from "@/hooks/useEnergyRefill";
import { HEAT_STAGES, getImplement, implementsFor, stageForHeat, type GameDefinition } from "@/lib/games/registry";
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
import { loadFreshness, loadOverride, loadTraits, saveTraits } from "@/lib/characters/storage";
import { recordBranchChoice } from "@/lib/characters/branch";
import type { ChapterDecision, ChapterHints, DialogueTree } from "@/lib/content/types";
import {
  applyForgottenRequestPenalty,
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

// She names an implement order once at the start of the round; switching to
// the WRONG next implement means you got it wrong — the round resets and it
// costs her trust a little (applyForgottenRequestPenalty, traits.ts). Just
// staying on one implement the whole round is a non-event (no attempt, no
// penalty) — only an actively wrong guess counts as "forgot what she said."
const SEQUENCE_LENGTH = 3;
const SEQUENCE_PROMPT_VISIBLE_MS = 5000;
// Reward for completing the whole sequence — a real payoff for pulling it
// off, not just "avoided the penalty."
const SEQUENCE_COMPLETE_BONUS_RATIO = 0.12;

function pickSequence(pool: string[]): string[] {
  const length = Math.min(SEQUENCE_LENGTH, pool.length);
  if (length < 2) return [];
  const sequence: string[] = [];
  let last: string | null = null;
  for (let i = 0; i < length; i++) {
    const options = pool.filter((id) => id !== last);
    const pick = options[Math.floor(Math.random() * options.length)] ?? pool[0];
    sequence.push(pick);
    last = pick;
  }
  return sequence;
}

function describeSequence(ids: string[]): string {
  return ids.map((id) => getImplement(id)?.name ?? id).join(" → ");
}

type Phase = "dialogue-intro" | "intro" | "playing" | "dialogue-outro" | "finale";

export function SpankGameSequence({
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
  const heatRef = useRef(0);
  const tapLogRef = useRef<TapOutcome[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const story = storyOverride ?? STORIES[game.id];
  const { text: hintText, visible: hintVisible, triggerStage, triggerBlocked } = useCharacterHint(hints);

  const [sequence, setSequence] = useState<string[]>([]);
  const expectedIndexRef = useRef(0);
  const lastTappedRef = useRef<string | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressFlash, setProgressFlash] = useState<"step" | "complete" | "fail" | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [failCount, setFailCount] = useState(0);

  function startNewSequence() {
    const unblockedIds = implements_
      .filter((impl) => !(traits && character && implementBlockReason(traits, character, impl, overriding)))
      .map((impl) => impl.id);
    const next = pickSequence(unblockedIds);
    setSequence(next);
    expectedIndexRef.current = 0;
    lastTappedRef.current = null;
    if (next.length > 0) {
      setPromptVisible(true);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      promptTimerRef.current = setTimeout(() => setPromptVisible(false), SEQUENCE_PROMPT_VISIBLE_MS);
    } else {
      setPromptVisible(false);
    }
  }

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const stage = stageForHeat((heat / game.maxHeat) * 100);
  const outOfEnergy = energy <= 0;

  function flash(kind: "step" | "complete" | "fail") {
    setProgressFlash(kind);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setProgressFlash(null), 1400);
  }

  function applyHeatGain(amount: number) {
    const next = Math.min(game.maxHeat, heatRef.current + amount);
    heatRef.current = next;
    setHeat(next);
    lifetimeRef.current += amount;
    window.localStorage.setItem(heatLifetimeKey(address, game.id), String(lifetimeRef.current));

    const nextStage = stageForHeat((next / game.maxHeat) * 100);
    if (nextStage.label !== stageRef.current.label) {
      stageRef.current = nextStage;
      playReactionSound();
      triggerStage(HEAT_STAGES.indexOf(nextStage));
    }

    if (next >= game.maxHeat && selected) {
      const durationMs = performance.now() - roundStartRef.current;
      const sessionQuality = classifySessionQuality(tapLogRef.current, implements_.length);
      const mood = traits ? moodTag(traits) : undefined;
      setFinaleBeat(
        resolveStoryVariant(
          story,
          game.id,
          { durationMs, implementId: selected.id, averagePace: 0 },
          mood,
          sessionQuality
        )
      );
      applyRoundToCharacter(address, game.id, selected.id, 0, sessionQuality);
      if (character) {
        setTraits(loadTraits(address, character));
        setOverrideState(loadOverride(address, character.id));
        setFreshness(loadFreshness(address, character));
      }
      playFinaleSound();
      setPhase(outroDialogue ? "dialogue-outro" : "finale");
    }
  }

  function failSequence() {
    setFailCount((n) => n + 1);
    flash("fail");
    if (character && traits) {
      const updated = applyForgottenRequestPenalty(traits);
      saveTraits(address, character.id, updated);
      setTraits(updated);
    }
    heatRef.current = 0;
    setHeat(0);
    stageRef.current = stageForHeat(0);
    roundStartRef.current = performance.now();
    tapLogRef.current = [];
    startNewSequence();
  }

  function handleTap() {
    if (!selected || outOfEnergy || phase !== "playing") return;
    if (traits && character && implementBlockReason(traits, character, selected, overriding)) {
      tapLogRef.current.push({ implementId: selected.id, blocked: true, matched: false, resonant: false });
      triggerBlocked();
      return;
    }
    if (!spend(1)) return;
    playTapSound();
    setPulseKey((k) => k + 1);

    tapLogRef.current.push({
      implementId: selected.id,
      blocked: false,
      matched: character ? matchesTolerance(character, classifyIntensity(selected, 0)) : true,
      resonant: character ? character.preferredImplementIds.includes(selected.id) : false,
    });

    // Only a SWITCH to a new implement counts as an attempt at the next
    // step — repeating the implement you're already on is never a wrong
    // guess, it just doesn't make progress either.
    const isSwitch = selected.id !== lastTappedRef.current;
    lastTappedRef.current = selected.id;

    if (isSwitch && sequence.length > 0 && expectedIndexRef.current < sequence.length) {
      if (selected.id === sequence[expectedIndexRef.current]) {
        expectedIndexRef.current += 1;
        if (expectedIndexRef.current >= sequence.length) {
          flash("complete");
          applyHeatGain(game.maxHeat * SEQUENCE_COMPLETE_BONUS_RATIO);
        } else {
          flash("step");
        }
      } else {
        failSequence();
        return;
      }
    }

    // Guard against the completion bonus above having already pushed heat
    // to the round's maxHeat and triggered the finale — applying a second
    // gain (and re-running the finale/applyRoundToCharacter logic) on the
    // very same tap would double-count the round.
    if (heatRef.current < game.maxHeat) {
      applyHeatGain(selected.heatPerHit);
    }
  }

  function handleNewRound() {
    heatRef.current = 0;
    setHeat(0);
    stageRef.current = stageForHeat(0);
    roundStartRef.current = performance.now();
    tapLogRef.current = [];
    setPickedOptionId(null);
    startNewSequence();
    setPhase("playing");
  }

  const heatPercent = (heat / game.maxHeat) * 100;
  const sequenceProgressLabel =
    sequence.length > 0
      ? `${Math.min(expectedIndexRef.current, sequence.length)}/${sequence.length}`
      : null;

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
          color={stage.color}
          label={phase === "finale" ? "Кульминация" : stage.label}
          caption={game.characterLabel}
          pulseKey={pulseKey}
        />

        <Card size="sm">
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${heatPercent}%`, backgroundColor: stage.color }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {Math.round(heat)} / {game.maxHeat}
            </p>
            {sequenceProgressLabel && (
              <p className="text-xs text-neutral-500" data-testid="sequence-progress">
                Порядок: {sequenceProgressLabel}
              </p>
            )}
          </div>
          {progressFlash && (
            <p
              className={`mt-1.5 text-xs font-medium ${
                progressFlash === "fail"
                  ? "text-rose-400"
                  : progressFlash === "complete"
                    ? "text-emerald-400"
                    : "text-neutral-300"
              }`}
              data-testid="sequence-feedback"
            >
              {progressFlash === "fail"
                ? "Не то, о чём она просила — начинаем заново."
                : progressFlash === "complete"
                  ? "Именно так, как она просила!"
                  : "Верно, дальше…"}
            </p>
          )}
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
        {failCount > 0 && (
          <p className="text-center text-xs text-neutral-600">Сбито попыток: {failCount}</p>
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

      {phase === "playing" && sequence.length > 0 && (
        <div
          data-testid="sequence-prompt"
          className={`pointer-events-none absolute left-1/2 top-4 z-30 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-900/90 px-4 py-2.5 text-center text-sm leading-snug text-neutral-100 shadow-xl shadow-black/40 backdrop-blur transition-opacity duration-700 ${
            promptVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-neutral-500">Она хочет:</span> {describeSequence(sequence)}
        </div>
      )}

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
              Она назовёт порядок орудий один раз — не собьётесь?
            </p>
            <Button
              onClick={() => {
                roundStartRef.current = performance.now();
                startNewSequence();
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
