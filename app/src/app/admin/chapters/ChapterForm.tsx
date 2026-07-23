"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CHARACTERS } from "@/lib/characters/registry";
import { GAMES, HEAT_STAGES, IMPLEMENTS } from "@/lib/games/registry";
import type { GameStory, StoryBeat, StoryTag } from "@/lib/games/stories";
import {
  emptyChapterHints,
  type ChapterHints,
  type ChapterRecord,
  type DialogueTree,
} from "@/lib/content/types";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FORM_CONTROL_CLASS, SELECT_CLASS } from "@/components/ui/Input";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type VariantRow = { tag: StoryTag; beat: StoryBeat };

// The 4 "mood + session quality" combo tags (see games/stories.ts's
// resolveStoryVariant) — flat values in the select, same as fast/slow,
// not nested behind a second picker like implement-*.
const COMBO_TAG_OPTIONS: { value: StoryTag; label: string }[] = [
  { value: "masterful-warm", label: "Мастерство · тепло" },
  { value: "masterful-cold", label: "Мастерство · холодно" },
  { value: "clumsy-warm", label: "Неаккуратно · тепло" },
  { value: "clumsy-cold", label: "Неаккуратно · холодно" },
];
const COMBO_TAG_SET = new Set(COMBO_TAG_OPTIONS.map((o) => o.value));

// Always exactly 2 — a decision is always a binary fork (see the
// ChapterDecision comment in lib/content/types.ts on why explicit-choice
// forks stay binary rather than open-ended).
type DecisionOptionForm = { label: string; result: StoryBeat };

// Editor-only shape for one DialogueTree node (lib/content/types.ts) — `mode`
// decides which of `next`/`choices` actually gets sent (see buildDialogueTree
// below), same "one field picks which other fields are live" pattern as the
// decision/variant forms elsewhere in this file.
type NodeForm = {
  id: string;
  speaker: string;
  text: string;
  image?: string;
  mode: "end" | "linear" | "branch";
  next: string; // used when mode === "linear"
  choices: { label: string; next: string }[]; // used when mode === "branch"
};

function nodeFormsFor(tree?: DialogueTree): NodeForm[] {
  if (!tree) return [];
  return tree.nodes.map((n) => ({
    id: n.id,
    speaker: n.speaker ?? "",
    text: n.text,
    image: n.image,
    mode: n.choices ? "branch" : n.next ? "linear" : "end",
    next: n.next ?? "",
    choices: n.choices ? n.choices.map((c) => ({ label: c.label, next: c.next })) : [],
  }));
}

// Empty array => "no scene" (field omitted from the payload) — same
// undefined-means-absent convention as `decision` below.
function buildDialogueTree(forms: NodeForm[]): DialogueTree | undefined {
  if (forms.length === 0) return undefined;
  return {
    nodes: forms.map((f) => ({
      id: f.id,
      text: f.text,
      ...(f.speaker.trim() ? { speaker: f.speaker } : {}),
      ...(f.image ? { image: f.image } : {}),
      ...(f.mode === "linear" && f.next ? { next: f.next } : {}),
      ...(f.mode === "branch" ? { choices: f.choices } : {}),
    })),
  };
}

function dialogueNodeLabel(node: NodeForm, index: number): string {
  const snippet = node.text.trim();
  if (!snippet) return `Узел ${index + 1}`;
  return snippet.length > 40 ? `${snippet.slice(0, 40)}…` : snippet;
}

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
  hints: ChapterHints;
  introDialogue: NodeForm[];
  outroDialogue: NodeForm[];
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
    hints: {
      stage: chapter.hints.stage.map((bucket) => [...bucket]) as ChapterHints["stage"],
      blocked: [...chapter.hints.blocked],
    },
    introDialogue: nodeFormsFor(chapter.introDialogue),
    outroDialogue: nodeFormsFor(chapter.outroDialogue),
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
    hints: emptyChapterHints(),
    introDialogue: [],
    outroDialogue: [],
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

// One "moment" row's hint pool — a handful of interchangeable lines, any of
// which might fire when that moment happens. Reused for each heat-stage
// bucket and for the "заблокировано" bucket (see the timeline below).
function HintBucketEditor({
  values,
  onChange,
  addTestId,
  fieldTestId,
  removeTestId,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  addTestId: string;
  fieldTestId: (i: number) => string;
  removeTestId: (i: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {values.map((hint, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={hint}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
            data-testid={fieldTestId(i)}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            data-testid={removeTestId(i)}
            className="text-xs text-rose-400 hover:text-rose-300"
          >
            Убрать
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        data-testid={addTestId}
        className="self-start text-xs text-neutral-500 transition hover:text-white"
      >
        + добавить реплику
      </button>
    </div>
  );
}

// Editor for one DialogueTree (lib/content/types.ts) — a flat list of nodes
// rather than a visual graph, same DIY level as the rest of this page.
// nodes[0] is the entry point (no separate "entry" field to manage). Each
// node picks one of three modes: "end" (leaf — the scene finishes here),
// "linear" (one target node) or "branch" (2+ labeled choices, each with its
// own target) — target pickers list every OTHER node by a text snippet, not
// a raw id, so authoring doesn't require memorizing generated ids.
function DialogueTreeEditor({
  nodes,
  onChange,
  addTestId,
}: {
  nodes: NodeForm[];
  onChange: (next: NodeForm[]) => void;
  addTestId: string;
}) {
  function addNode() {
    onChange([
      ...nodes,
      { id: crypto.randomUUID(), speaker: "", text: "", mode: "end", next: "", choices: [] },
    ]);
  }
  function updateNode(i: number, patch: Partial<NodeForm>) {
    const next = [...nodes];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function removeNode(i: number) {
    onChange(nodes.filter((_, idx) => idx !== i));
  }
  function targetOptions(excludeId: string) {
    return nodes.filter((n) => n.id !== excludeId);
  }

  return (
    <div className="flex flex-col gap-3">
      {nodes.map((node, i) => (
        <div key={node.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-400">
              {i === 0 ? "Узел 1 (начало сцены)" : `Узел ${i + 1}`}
            </span>
            <button
              type="button"
              onClick={() => removeNode(i)}
              data-testid={`dialogue-remove-node-${i}`}
              className="text-xs text-rose-400 hover:text-rose-300"
            >
              Убрать
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={node.speaker}
              onChange={(e) => updateNode(i, { speaker: e.target.value })}
              placeholder="Говорящий (необязательно)"
              data-testid={`dialogue-speaker-${i}`}
            />
            <textarea
              value={node.text}
              onChange={(e) => updateNode(i, { text: e.target.value })}
              rows={2}
              placeholder="Реплика"
              data-testid={`dialogue-text-${i}`}
              className={FORM_CONTROL_CLASS}
            />
          </div>
          <div className="mt-2">
            <ImageUploadField image={node.image} onChange={(image) => updateNode(i, { image })} />
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <select
              value={node.mode}
              onChange={(e) => updateNode(i, { mode: e.target.value as NodeForm["mode"] })}
              data-testid={`dialogue-mode-${i}`}
              className={SELECT_CLASS}
            >
              <option value="end">Конец сцены (переход дальше)</option>
              <option value="linear">Дальше → один узел</option>
              <option value="branch">Развилка (варианты ответа)</option>
            </select>

            {node.mode === "linear" && (
              <select
                value={node.next}
                onChange={(e) => updateNode(i, { next: e.target.value })}
                data-testid={`dialogue-next-${i}`}
                className={`${SELECT_CLASS} mt-2`}
              >
                <option value="">— выбрать узел —</option>
                {targetOptions(node.id).map((n) => (
                  <option key={n.id} value={n.id}>
                    {dialogueNodeLabel(n, nodes.indexOf(n))}
                  </option>
                ))}
              </select>
            )}

            {node.mode === "branch" && (
              <div className="mt-2 flex flex-col gap-2">
                {node.choices.map((choice, ci) => (
                  <div key={ci} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-2">
                    <Input
                      value={choice.label}
                      onChange={(e) => {
                        const choices = [...node.choices];
                        choices[ci] = { ...choice, label: e.target.value };
                        updateNode(i, { choices });
                      }}
                      placeholder="Текст кнопки"
                      data-testid={`dialogue-choice-label-${i}-${ci}`}
                      className="flex-1"
                    />
                    <select
                      value={choice.next}
                      onChange={(e) => {
                        const choices = [...node.choices];
                        choices[ci] = { ...choice, next: e.target.value };
                        updateNode(i, { choices });
                      }}
                      data-testid={`dialogue-choice-next-${i}-${ci}`}
                      className={SELECT_CLASS}
                    >
                      <option value="">— выбрать узел —</option>
                      {targetOptions(node.id).map((n) => (
                        <option key={n.id} value={n.id}>
                          {dialogueNodeLabel(n, nodes.indexOf(n))}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateNode(i, { choices: node.choices.filter((_, idx) => idx !== ci) })}
                      data-testid={`dialogue-choice-remove-${i}-${ci}`}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Убрать
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateNode(i, { choices: [...node.choices, { label: "", next: "" }] })}
                  data-testid={`dialogue-choice-add-${i}`}
                  className="self-start text-xs text-neutral-500 transition hover:text-white"
                >
                  + добавить вариант ответа
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <Button onClick={addNode} variant="secondary" size="sm" data-testid={addTestId}>
        Добавить узел
      </Button>
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
      hints: {
        stage: f.hints.stage.map((bucket) => bucket.filter((h) => h.trim())) as ChapterHints["stage"],
        blocked: f.hints.blocked.filter((h) => h.trim()),
      },
      decision: f.decisionEnabled
        ? {
            prompt: f.decisionPrompt,
            options: [
              { id: "0", label: f.decisionOptions[0].label, result: f.decisionOptions[0].result },
              { id: "1", label: f.decisionOptions[1].label, result: f.decisionOptions[1].result },
            ],
          }
        : undefined,
      introDialogue: buildDialogueTree(f.introDialogue),
      outroDialogue: buildDialogueTree(f.outroDialogue),
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
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
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
        <div className="mb-2 flex items-center justify-between">
          <SectionHeading dense>Диалог перед игрой</SectionHeading>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Полноэкранная сцена перед раундом — заменяет статичную заставку выше, когда задана. Все
          ветки должны в итоге сходиться к одному узлу без «Дальше»/развилки — это и есть переход к
          игре.
        </p>
        <DialogueTreeEditor
          nodes={form.introDialogue}
          onChange={(introDialogue) => setForm({ ...form, introDialogue })}
          addTestId="admin-chapter-add-intro-node"
        />
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
        <SectionHeading dense className="mb-2">
          Диалог после игры
        </SectionHeading>
        <p className="mb-3 text-xs text-neutral-500">
          Полноэкранная сцена сразу после раунда, перед финальной модалкой (текст
          финала/тизер/развилка ниже). Тоже должна сходиться к одному листовому узлу.
        </p>
        <DialogueTreeEditor
          nodes={form.outroDialogue}
          onChange={(outroDialogue) => setForm({ ...form, outroDialogue })}
          addTestId="admin-chapter-add-outro-node"
        />
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
                    value={
                      row.tag === "fast" || row.tag === "slow" || COMBO_TAG_SET.has(row.tag)
                        ? row.tag
                        : "implement"
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      const nextTag: StoryTag =
                        value === "implement" ? `implement-${IMPLEMENTS[0]?.id ?? ""}` : (value as StoryTag);
                      const next = [...form.variants];
                      next[i] = { ...row, tag: nextTag };
                      setForm({ ...form, variants: next });
                    }}
                    data-testid={`admin-chapter-variant-tag-${i}`}
                    className={SELECT_CLASS}
                  >
                    <option value="fast">Быстро</option>
                    <option value="slow">Медленно</option>
                    {COMBO_TAG_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                      className={SELECT_CLASS}
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
        <SectionHeading dense className="mb-1">
          Подсказки-реакции (всплывающие на пару секунд)
        </SectionHeading>
        <p className="mb-4 text-xs text-neutral-500">
          Слева — момент по ходу раунда, справа — реплики, любая из которых может всплыть именно в
          этот момент (случайно, без повтора предыдущей).
        </p>

        <div className="relative flex flex-col">
          <div className="pointer-events-none absolute left-[7px] top-2 bottom-7 w-px bg-white/10" />

          {HEAT_STAGES.map((stageDef, i) => (
            <div key={stageDef.label} className="relative flex gap-4 pb-5">
              <div className="flex w-28 shrink-0 items-start gap-2 pt-0.5">
                <span
                  className="relative z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-neutral-950"
                  style={{ backgroundColor: stageDef.color }}
                />
                <span className="text-xs font-medium text-neutral-300">{stageDef.label}</span>
              </div>
              <div className="min-w-0 flex-1">
                <HintBucketEditor
                  values={form.hints.stage[i]}
                  onChange={(next) => {
                    const stage = [...form.hints.stage] as ChapterHints["stage"];
                    stage[i] = next;
                    setForm({ ...form, hints: { ...form.hints, stage } });
                  }}
                  addTestId={`admin-chapter-add-hint-stage-${i}`}
                  fieldTestId={(j) => `admin-chapter-hint-stage-${i}-${j}`}
                  removeTestId={(j) => `admin-chapter-remove-hint-stage-${i}-${j}`}
                />
              </div>
            </div>
          ))}

          <div className="relative flex gap-4">
            <div className="flex w-28 shrink-0 items-start gap-2 pt-0.5">
              <span className="relative z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-neutral-950 bg-neutral-600" />
              <span className="text-xs font-medium text-neutral-300">Заблокировано</span>
            </div>
            <div className="min-w-0 flex-1">
              <HintBucketEditor
                values={form.hints.blocked}
                onChange={(next) => setForm({ ...form, hints: { ...form.hints, blocked: next } })}
                addTestId="admin-chapter-add-hint-blocked"
                fieldTestId={(j) => `admin-chapter-hint-blocked-${j}`}
                removeTestId={(j) => `admin-chapter-remove-hint-blocked-${j}`}
              />
            </div>
          </div>
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
