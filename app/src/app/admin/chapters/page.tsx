"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CHARACTERS } from "@/lib/characters/registry";
import type { ChapterRecord } from "@/lib/content/types";
import { SectionHeading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";
import { FORM_CONTROL_CLASS } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canEditGames, ROLE_LABELS } from "@/lib/admin/roles";
import { chapterLabel } from "./ChapterForm";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const ALL_CHARACTERS = "all";

export default function ChaptersPage() {
  const router = useRouter();
  const whoAmIQuery = useAdminWhoAmI();
  const [characterFilter, setCharacterFilter] = useState<string>(ALL_CHARACTERS);

  const chaptersQuery = useQuery({
    queryKey: ["chapters"],
    queryFn: () => fetchJson<{ chapters: ChapterRecord[] }>("/api/games/chapters"),
  });
  const chapters = [...(chaptersQuery.data?.chapters ?? [])]
    .filter((c) => characterFilter === ALL_CHARACTERS || c.characterId === characterFilter)
    .sort((a, b) =>
      a.characterId === b.characterId ? a.order - b.order : a.characterId.localeCompare(b.characterId)
    );

  if (whoAmIQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Загрузка…</p>;
  }
  const who = whoAmIQuery.data;
  if (!who?.isAdmin || !canEditGames(who.role)) {
    return (
      <p className="text-sm text-neutral-500">
        Доступ запрещён — редактирование глав доступно только роли «{ROLE_LABELS.owner}».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionHeading dense>Главы</SectionHeading>
          <div className="flex items-center gap-2">
            <select
              value={characterFilter}
              onChange={(e) => setCharacterFilter(e.target.value)}
              data-testid="admin-chapter-character-filter"
              className={FORM_CONTROL_CLASS}
            >
              <option value={ALL_CHARACTERS}>Все персонажи</option>
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={() => router.push("/admin/chapters/new")} size="sm" data-testid="admin-add-chapter">
              Добавить главу
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Текст и изображения главы независимы от текста той же pilot-игры в свободной игре — правки
          здесь её не затрагивают.
        </p>
        <Table columns={["Персонаж", "Глава", "Название", "Игра", "Порог", ""]}>
          {chaptersQuery.isLoading && (
            <tr>
              <td className="px-3 py-3 text-neutral-500" colSpan={6}>
                Загрузка…
              </td>
            </tr>
          )}
          {!chaptersQuery.isLoading && chapters.length === 0 && (
            <tr>
              <td className="px-3 py-3 text-neutral-500" colSpan={6}>
                Нет глав для этого фильтра.
              </td>
            </tr>
          )}
          {chapters.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/admin/chapters/${c.id}`)}
              data-testid={`admin-chapter-${c.id}`}
              className="cursor-pointer border-t border-white/5 hover:bg-white/[0.04]"
            >
              <td className="px-3 py-2">
                {CHARACTERS.find((ch) => ch.id === c.characterId)?.name ?? c.characterId}
              </td>
              <td className="px-3 py-2">{chapterLabel(c.order, c.branchPath)}</td>
              <td className="px-3 py-2 text-neutral-400">{c.chapterTitle}</td>
              <td className="px-3 py-2 font-mono text-neutral-400">{c.gameId}</td>
              <td className="px-3 py-2">{c.unlockThreshold}</td>
              <td className="px-3 py-2 text-neutral-500">→</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
