"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAllChapters } from "@/hooks/useChapters";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canEditGames, ROLE_LABELS } from "@/lib/admin/roles";
import { ChapterForm } from "../ChapterForm";

export default function EditChapterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const whoAmIQuery = useAdminWhoAmI();
  const chaptersQuery = useAllChapters();
  const chapter = chaptersQuery.data?.find((c) => c.id === params.id);

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
    <div className="flex flex-col gap-4">
      <Link href="/admin/chapters" className="self-start text-sm text-neutral-400 transition hover:text-white">
        ← Главы
      </Link>
      {chaptersQuery.isLoading ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : chapter ? (
        <ChapterForm key={chapter.id} chapter={chapter} onDone={() => router.push("/admin/chapters")} />
      ) : (
        <p className="text-sm text-neutral-500">Глава не найдена — возможно, была удалена.</p>
      )}
    </div>
  );
}
