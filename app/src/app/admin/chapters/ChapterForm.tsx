"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CHARACTERS } from "@/lib/characters/registry";
import { GAMES, IMPLEMENTS } from "@/lib/games/registry";
import type { GameStory, StoryBeat, StoryTag } from "@/lib/games/stories";
import type { ChapterRecord } from "@/lib/content/types";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FORM_CONTROL_CLASS } from "@/components/ui/Input";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type VariantRow = { tag: StoryTag; beat: StoryBeat };

// Always exactly 2 — a decision is always a binary fork (see the
// ChapterDecision comment in lib/content/types.ts on why explicit-choice
// forks stay binary rather than open-ended).
type DecisionOptionForm = { label: string; result: StoryBeat };

type FormState = {
  characterId: string;
  gameId: string;
  order: string;
  unlockThreshold: string;
  chapterTitle: string;
  nextTeaser: string;
  intro: StoryBeat;
  fallback: StoryBeat;
  variants: VariantRow[];
  // "" for the single order-1/2 variant, "0"/"1" for order-3, "00".."11" for
  // order-4 — see chaptersOnPath (hooks/useChapters.ts). Plain text field
  // here, no tree widget — same DIY level as the rest of this page.
  branchPath: string;
  decisionEnabled: boolean;
  decisionPrompt: StoryBeat;
  decisionOptions: [DecisionOptionForm, DecisionOptionForm];
};

function emptyBeat(): StoryBeat {
  return { text: "" };
}

// Human-readable label for a chapter variant — "Глава 3, сценарий 1" instead
// of the raw branchPath ("0"). Each branchPath digit is one decision level,
// so a multi-digit path reads as a dotted scenario number ("1.2") showing
// which earlier scenario it descends from — "00"/"01" (children of chapter
// 3's scenario 1) become "1.1"/"1.2", "10"/"11" (children of scenario 2)
// become "2.1"/"2.2". No branch yet (chapters 1-2) is just "Глава N".
export function chapterLabel(order: number, branchPath: string): string {
  if (!branchPath) return `Глава ${order}`;
  const scenario = branchPath
    .split("")
    .map((bit) => Number(bit) + 1)
    .join(".");
  return `Глава ${order}, сценарий ${scenario}`;
}

function emptyDecisionOptions(): [DecisionOptionForm, DecisionOptionForm] {
  return [
    { label: "", result: emptyBeat() },
    { label: "", result: emptyBeat() },
  ];
}

function formFor(chapter: ChapterRecord): FormState {
  return {
    characterId: chapter.characterId,
    gameId: chapter.gameId,
    order: String(chapter.order),
    unlockThreshold: String(chapter.unlockThreshold),
    chapterTitle: chapter.chapterTitle,
    nextTeaser: chapter.nextTeaser,
    intro: chapter.story.intro,
    fallback: chapter.story.fallback,
    variants: Object.entries(chapter.story.variants).map(([tag, beat]) => ({
      tag: tag as StoryTag,
      beat: beat as StoryBeat,
    })),
    branchPath: chapter.branchPath,
    decisionEnabled: chapter.decision !== undefined,
    decisionPrompt: chapter.decision?.prompt ?? emptyBeat(),
    decisionOptions: chapter.decision
      ? [
          { label: chapter.decision.options[0].label, result: chapter.decision.options[0].result },
          { label: chapter.decision.options[1].label, result: chapter.decision.options[1].result },
        ]
      : emptyDecisionOptions(),
  };
}

function blankForm(): FormState {
  const firstCharacter = CHARACTERS[0];
  const firstChapterGame = GAMES.find(
    (g) => g.type === "chapter" && firstCharacter?.gameIds.includes(g.id)
  );
  return {
    characterId: firstCharacter?.id ?? "",
    gameId: firstChapterGame?.id ?? "",
    order: "1",
    unlockThreshold: "0",
    chapterTitle: "",
    nextTeaser: "",
    intro: emptyBeat(),
    fallback: emptyBeat(),
    variants: [],
    branchPath: "",
    decisionEnabled: false,
    decisionPrompt: emptyBeat(),
    decisionOptions: emptyDecisionOptions(),
  };
}

// Local, page-scoped upload control for a single StoryBeat's image — used
// 2 + N times per form (intro, fallback, each variant/decision beat), so it
// lives here rather than as a new components/ui file for a single-consumer
// concern.
function ImageUploadField({
  image,
  onChange,
}: {
  image?: string;
  onChange: (url: string | undefined) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/chapters/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-12 w-12 rounded-lg object-cover" />
      )}
      <label className="cursor-pointer rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-white/20 hover:text-white">
        {pending ? "…" : image ? "Заменить изображение" : "Загрузить изображение"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {image && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-xs text-rose-400 hover:text-rose-300"
        >
          Убрать
        </button>
      )}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}

// Full editor for one chapter variant — used by both /admin/chapters/new
// (no `chapter` prop, starts blank) and /admin/chapters/[id] (existing
// chapter, pre-filled). `onDone` fires after a successful save or delete so
// the page can navigate back to the list.
export function ChapterForm({
  chapter,
  onDone,
}: {
  chapter?: ChapterRecord;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (chapter ? formFor(chapter) : blankForm()));
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["chapters"] });
  }

  function buildStory(f: FormState): GameStory {
    const variants: GameStory["variants"] = {};
    for (const row of f.variants) {
      if (row.beat.text.trim()) variants[row.tag] = row.beat;
    }
    return { intro: f.intro, fallback: f.fallback, variants };
  }

  function buildPayload(f: FormState) {
    return {
      characterId: f.characterId,
      gameId: f.gameId,
      order: Number(f.order),
      unlockThreshold: Number(f.unlockThreshold),
      chapterTitle: f.chapterTitle,
      nextTeaser: f.nextTeaser,
      story: buildStory(f),
      branchPath: f.branchPath,
      decision: f.decisionEnabled
        ? {
            prompt: f.decisionPrompt,
            options: [
              { id: "0", label: f.decisionOptions[0].label, result: f.decisionOptions[0].result },
              { id: "1", label: f.decisionOptions[1].label, result: f.decisionOptions[1].result },
            ],
          }
        : undefined,
    };
  }

  const create = useMutation({
    mutationFn: (f: FormState) =>
      fetchJson<{ chapter: ChapterRecord }>("/api/admin/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(f)),
      }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const update = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      fetchJson("/api/admin/chapters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...buildPayload(f) }),
      }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/chapters?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  function save() {
    setError(null);
    if (chapter) {
      update.mutate({ id: chapter.id, f: form });
    } else {
      create.mutate(form);
    }
  }

  const selectedCharacter = CHARACTERS.find((c) => c.id === form.characterId);
  const chapterGames = GAMES.filter((g) => g.type === "chapter");
  const gameOptions = selectedCharacter
    ? chapterGames.filter((g) => selectedCharacter.gameIds.includes(g.id))
    : chapterGames;

  return (
    <Card>
      <SectionHeading dense className="mb-3">
        {chapter ? `Редактировать: ${chapterLabel(Number(form.order) || 1, form.branchPath)}` : "Новая глава"}
      </SectionHeading>
      {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">Персонаж</label>
          <select
            value={form.characterId}
            onChange={(e) => {
              const characterId = e.target.value;
              const char = CHARACTERS.find((c) => c.id === characterId);
              const firstChapterGame = GAMES.find(
                (g) => g.type === "chapter" && char?.gameIds.includes(g.id)
              );
              setForm({ ...form, characterId, gameId: firstChapterGame?.id ?? form.gameId });
            }}
            data-testid="admin-chapter-character"
            className={FORM_CONTROL_CLASS}
          >
            {CHARACTERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">Игра</label>
          <select
            value={form.gameId}
            onChange={(e) => setForm({ ...form, gameId: e.target.value })}
            data-testid="admin-chapter-game"
            className={FORM_CONTROL_CLASS}
          >
            {gameOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">Порядок</label>
          <Input
            type="number"
            min={1}
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
            data-testid="admin-chapter-order"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">Порог открытия (отклик)</label>
          <Input
            type="number"
            min={0}
            value={form.unlockThreshold}
            onChange={(e) => setForm({ ...form, unlockThreshold: e.target.value })}
            data-testid="admin-chapter-threshold"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">
            Ветка («» / «0»/«1» / «00»..«11» — длина = порядок − 2)
          </label>
          <Input
            value={form.branchPath}
            onChange={(e) => setForm({ ...form, branchPath: e.target.value })}
            placeholder="напр. 01"
            data-testid="admin-chapter-branch-path"
          />
          <p className="text-xs text-neutral-500" data-testid="admin-chapter-scenario-preview">
            → {chapterLabel(Number(form.order) || 1, form.branchPath)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="text-xs text-neutral-400">Название главы</label>
          <Input
            value={form.chapterTitle}
            onChange={(e) => setForm({ ...form, chapterTitle: e.target.value })}
            data-testid="admin-chapter-title"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="text-xs text-neutral-400">Тизер следующей главы</label>
          <textarea
            value={form.nextTeaser}
            onChange={(e) => setForm({ ...form, nextTeaser: e.target.value })}
            rows={2}
            data-testid="admin-chapter-teaser"
            className={FORM_CONTROL_CLASS}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <SectionHeading dense className="mb-2">
          Вступление
        </SectionHeading>
        <textarea
          value={form.intro.text}
          onChange={(e) => setForm({ ...form, intro: { ...form.intro, text: e.target.value } })}
          rows={3}
          data-testid="admin-chapter-intro-text"
          className={`${FORM_CONTROL_CLASS} w-full`}
        />
        <div className="mt-2">
          <ImageUploadField
            image={form.intro.image}
            onChange={(image) => setForm({ ...form, intro: { ...form.intro, image } })}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <SectionHeading dense className="mb-2">
          Развязка по умолчанию
        </SectionHeading>
        <textarea
          value={form.fallback.text}
          onChange={(e) => setForm({ ...form, fallback: { ...form.fallback, text: e.target.value } })}
          rows={3}
          data-testid="admin-chapter-fallback-text"
          className={`${FORM_CONTROL_CLASS} w-full`}
        />
        <div className="mt-2">
          <ImageUploadField
            image={form.fallback.image}
            onChange={(image) => setForm({ ...form, fallback: { ...form.fallback, image } })}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeading dense>Варианты по ходу раунда</SectionHeading>
          <Button
            onClick={() =>
              setForm({ ...form, variants: [...form.variants, { tag: "fast", beat: emptyBeat() }] })
            }
            variant="secondary"
            size="sm"
            data-testid="admin-chapter-add-variant"
          >
            Добавить вариант
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {form.variants.map((row, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.tag === "fast" || row.tag === "slow" ? row.tag : "implement"}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nextTag: StoryTag =
                        value === "implement" ? `implement-${IMPLEMENTS[0]?.id ?? ""}` : (value as StoryTag);
                      const next = [...form.variants];
                      next[i] = { ...row, tag: nextTag };
                      setForm({ ...form, variants: next });
                    }}
                    data-testid={`admin-chapter-variant-tag-${i}`}
                    className={FORM_CONTROL_CLASS}
                  >
                    <option value="fast">Быстро</option>
                    <option value="slow">Медленно</option>
                    <option value="implement">Орудие…</option>
                  </select>
                  {row.tag.startsWith("implement-") && (
                    <select
                      value={row.tag.slice("implement-".length)}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[i] = { ...row, tag: `implement-${e.target.value}` };
                        setForm({ ...form, variants: next });
                      }}
                      className={FORM_CONTROL_CLASS}
                    >
                      {IMPLEMENTS.map((impl) => (
                        <option key={impl.id} value={impl.id}>
                          {impl.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })}
                  data-testid={`admin-chapter-remove-variant-${i}`}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Убрать
                </button>
              </div>
              <textarea
                value={row.beat.text}
                onChange={(e) => {
                  const next = [...form.variants];
                  next[i] = { ...row, beat: { ...row.beat, text: e.target.value } };
                  setForm({ ...form, variants: next });
                }}
                rows={2}
                className={`${FORM_CONTROL_CLASS} mt-2 w-full`}
              />
              <div className="mt-2">
                <ImageUploadField
                  image={row.beat.image}
                  onChange={(image) => {
                    const next = [...form.variants];
                    next[i] = { ...row, beat: { ...row.beat, image } };
                    setForm({ ...form, variants: next });
                  }}
                />
              </div>
            </div>
          ))}
          {form.variants.length === 0 && (
            <p className="text-xs text-neutral-500">
              Нет вариантов — всегда будет показана «Развязка по умолчанию».
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={form.decisionEnabled}
            onChange={(e) => setForm({ ...form, decisionEnabled: e.target.checked })}
            data-testid="admin-chapter-decision-toggle"
          />
          У этой главы есть развилка
        </label>
        {form.decisionEnabled && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className="text-xs text-neutral-400">Реплика перед выбором</label>
              <textarea
                value={form.decisionPrompt.text}
                onChange={(e) =>
                  setForm({ ...form, decisionPrompt: { ...form.decisionPrompt, text: e.target.value } })
                }
                rows={2}
                data-testid="admin-chapter-decision-prompt"
                className={`${FORM_CONTROL_CLASS} mt-1 w-full`}
              />
              <div className="mt-2">
                <ImageUploadField
                  image={form.decisionPrompt.image}
                  onChange={(image) =>
                    setForm({ ...form, decisionPrompt: { ...form.decisionPrompt, image } })
                  }
                />
              </div>
            </div>
            {form.decisionOptions.map((option, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <label className="text-xs text-neutral-400">Вариант {i === 0 ? "0" : "1"} — текст кнопки</label>
                <Input
                  value={option.label}
                  onChange={(e) => {
                    const next: [DecisionOptionForm, DecisionOptionForm] = [...form.decisionOptions];
                    next[i] = { ...option, label: e.target.value };
                    setForm({ ...form, decisionOptions: next });
                  }}
                  data-testid={`admin-chapter-decision-option-${i}-label`}
                  className="mt-1"
                />
                <label className="mt-2 block text-xs text-neutral-400">Реакция после выбора</label>
                <textarea
                  value={option.result.text}
                  onChange={(e) => {
                    const next: [DecisionOptionForm, DecisionOptionForm] = [...form.decisionOptions];
                    next[i] = { ...option, result: { ...option.result, text: e.target.value } };
                    setForm({ ...form, decisionOptions: next });
                  }}
                  rows={2}
                  data-testid={`admin-chapter-decision-option-${i}-result`}
                  className={`${FORM_CONTROL_CLASS} mt-1 w-full`}
                />
                <div className="mt-2">
                  <ImageUploadField
                    image={option.result.image}
                    onChange={(image) => {
                      const next: [DecisionOptionForm, DecisionOptionForm] = [...form.decisionOptions];
                      next[i] = { ...option, result: { ...option.result, image } };
                      setForm({ ...form, decisionOptions: next });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={save}
          disabled={create.isPending || update.isPending}
          data-testid="admin-chapter-save"
          size="sm"
        >
          {create.isPending || update.isPending ? "…" : "Сохранить"}
        </Button>
        {chapter && (
          <Button
            onClick={() => remove.mutate(chapter.id)}
            disabled={remove.isPending}
            variant="secondary"
            size="sm"
            data-testid="admin-chapter-delete"
          >
            Удалить
          </Button>
        )}
      </div>
    </Card>
  );
}
