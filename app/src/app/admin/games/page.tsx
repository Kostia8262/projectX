"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyGameOverrides,
  type GameDefinition,
  type GameOverride,
  type GameStatus,
  type GameType,
} from "@/lib/games/registry";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FORM_CONTROL_CLASS } from "@/components/ui/Input";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canEditGames, ROLE_LABELS } from "@/lib/admin/roles";

type GamesResponse = { games: GameDefinition[]; overrides: Record<string, GameOverride> };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type EditForm = {
  status: GameStatus;
  title: string;
  tagline: string;
  description: string;
  maxHeat: string;
};

type TypeFilter = "all" | GameType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "free", label: "Свободные" },
  { value: "chapter", label: "Главы" },
];

function formFor(game: GameDefinition): EditForm {
  return {
    status: game.status,
    title: game.title,
    tagline: game.tagline,
    description: game.description,
    maxHeat: String(game.maxHeat),
  };
}

export default function GamesPage() {
  const queryClient = useQueryClient();
  const whoAmIQuery = useAdminWhoAmI();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const gamesQuery = useQuery({
    queryKey: ["admin-games"],
    queryFn: () => fetchJson<GamesResponse>("/api/admin/games"),
  });

  const effectiveGames = gamesQuery.data
    ? applyGameOverrides(gamesQuery.data.games, gamesQuery.data.overrides)
    : [];
  // Free-play and chapter-only games are two separate pools by design (see
  // GameType in games/registry.ts) — this filter is purely a display
  // convenience so an admin editing one pool doesn't have to scroll past
  // the other, not a data change.
  const visibleGames = effectiveGames.filter((g) => typeFilter === "all" || g.type === typeFilter);
  const baseGames = gamesQuery.data?.games ?? [];
  const overrides = gamesQuery.data?.overrides ?? {};

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-games"] });
    // Same data the player-facing menu/character page reads — keep this
    // tab's edits visible without a full reload if both are open.
    queryClient.invalidateQueries({ queryKey: ["game-overrides"] });
  }

  const save = useMutation({
    mutationFn: (gameId: string) => {
      if (!form) throw new Error("Нечего сохранять");
      const maxHeat = Number(form.maxHeat);
      if (!Number.isFinite(maxHeat) || maxHeat <= 0) throw new Error("maxHeat должен быть положительным числом");
      const patch: GameOverride = {
        status: form.status,
        title: form.title,
        tagline: form.tagline,
        description: form.description,
        maxHeat,
      };
      return fetchJson("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, patch }),
      });
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const reset = useMutation({
    mutationFn: (gameId: string) =>
      fetchJson(`/api/admin/games?gameId=${encodeURIComponent(gameId)}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      setForm(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  function selectGame(game: GameDefinition) {
    setError(null);
    setSelectedId(game.id);
    setForm(formFor(game));
  }

  const selectedBase = baseGames.find((g) => g.id === selectedId);

  if (whoAmIQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Загрузка…</p>;
  }
  const who = whoAmIQuery.data;
  if (!who?.isAdmin || !canEditGames(who.role)) {
    return (
      <p className="text-sm text-neutral-500">
        Доступ запрещён — редактирование игр доступно только роли «{ROLE_LABELS.owner}».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading dense className="mb-2">
          Игры
        </SectionHeading>
        <p className="mb-3 text-xs text-neutral-500">
          Базовые данные (id, набор орудий, механика) — в коде, <code>games/registry.ts</code>, тут не
          редактируются. Статус и текстовые поля можно переопределить — правки сразу видны игрокам
          в меню игр, на странице персонажа и в самой сцене.
        </p>
        <div className="mb-3 flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              variant={typeFilter === f.value ? "primary" : "secondary"}
              size="sm"
              data-testid={`admin-games-filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-neutral-400">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Название</th>
                <th className="px-3 py-2">Тег</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">maxHeat</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {gamesQuery.isLoading && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={7}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {!gamesQuery.isLoading && visibleGames.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={7}>
                    Нет игр этого типа.
                  </td>
                </tr>
              )}
              {visibleGames.map((game) => {
                const overridden = Boolean(overrides[game.id]);
                return (
                  <tr
                    key={game.id}
                    onClick={() => selectGame(game)}
                    data-testid={`admin-game-${game.id}`}
                    className={`cursor-pointer border-t border-white/5 hover:bg-white/[0.04] ${
                      selectedId === game.id ? "bg-fuchsia-500/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-neutral-400">{game.id}</td>
                    <td className="px-3 py-2 text-neutral-200">{game.title}</td>
                    <td className="px-3 py-2 text-neutral-400">{game.tagline}</td>
                    <td className="px-3 py-2">
                      <span className={game.type === "chapter" ? "text-indigo-300" : "text-neutral-400"}>
                        {game.type === "chapter" ? "глава" : "свободная"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-400">{game.maxHeat}</td>
                    <td className="px-3 py-2">
                      <span
                        className={game.status === "available" ? "text-emerald-400" : "text-neutral-500"}
                      >
                        {game.status === "available" ? "включена" : "скоро"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {overridden && <span className="text-xs text-amber-400/80">изменено</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBase && form && (
        <Card>
          <SectionHeading dense className="mb-1">
            Редактировать: {selectedBase.id}
          </SectionHeading>
          <p className="mb-4 text-xs text-neutral-500">
            По умолчанию (из кода): «{selectedBase.title}», {selectedBase.status === "available" ? "включена" : "скоро"},
            maxHeat {selectedBase.maxHeat}.
          </p>
          {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-400">Статус</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as GameStatus })}
                data-testid="admin-game-status"
                className={FORM_CONTROL_CLASS}
              >
                <option value="available">включена (available)</option>
                <option value="coming-soon">выключена (coming-soon)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-400">maxHeat</label>
              <Input
                type="number"
                min={1}
                value={form.maxHeat}
                onChange={(e) => setForm({ ...form, maxHeat: e.target.value })}
                data-testid="admin-game-maxheat"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-400">Название</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="admin-game-title"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-400">Тег (короткая подпись)</label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                data-testid="admin-game-tagline"
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-xs text-neutral-400">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                data-testid="admin-game-description"
                className={FORM_CONTROL_CLASS}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => selectedId && save.mutate(selectedId)}
              disabled={save.isPending}
              data-testid="admin-game-save"
              size="sm"
            >
              {save.isPending ? "…" : "Сохранить"}
            </Button>
            {overrides[selectedId ?? ""] && (
              <Button
                onClick={() => selectedId && reset.mutate(selectedId)}
                disabled={reset.isPending}
                data-testid="admin-game-reset"
                variant="secondary"
                size="sm"
              >
                {reset.isPending ? "…" : "Сбросить к значениям по умолчанию"}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
