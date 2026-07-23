"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canEditGames, ROLE_LABELS } from "@/lib/admin/roles";
import { ChapterForm } from "../ChapterForm";

export default function NewChapterPage() {
  const router = useRouter();
  const whoAmIQuery = useAdminWhoAmI();

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
      <ChapterForm onDone={() => router.push("/admin/chapters")} />
    </div>
  );
}
