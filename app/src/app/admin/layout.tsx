"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/ui/Heading";

type WhoAmI =
  | { isAdmin: true; address: string }
  | { isAdmin: false; reason: "no-session" }
  | { isAdmin: false; reason: "not-wallet"; address: string }
  | { isAdmin: false; reason: "not-admin"; address: string };

async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch("/api/admin/whoami");
  return res.json();
}

const TABS = [
  { href: "/admin", label: "Кошельки" },
  { href: "/admin/employees", label: "Сотрудники" },
  { href: "/admin/transactions", label: "Транзакции" },
  { href: "/admin/games", label: "Игры" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const whoAmIQuery = useQuery({ queryKey: ["admin-whoami"], queryFn: fetchWhoAmI });

  if (whoAmIQuery.isLoading) {
    return <p className="p-10 text-neutral-500">Загрузка…</p>;
  }

  const who = whoAmIQuery.data;

  // Real enforcement is server-side (requireAdminSession on every
  // /api/admin/* route) — this is UX only, but showing WHY matters here:
  // the allowlist is two hardcoded/UI-managed lists, and a mismatch is the
  // overwhelmingly likely cause of ending up here.
  if (!who || !who.isAdmin) {
    const reason = who?.reason;
    const message =
      reason === "not-wallet" ? (
        <>Админка работает только с кошельком, а вы вошли через Patreon.</>
      ) : reason === "not-admin" ? (
        <>
          Кошелёк {(who as { address: string }).address} не в списке админов —
          ни в <code className="text-neutral-400">ADMIN_ADDRESSES</code> (
          <code className="text-neutral-400">lib/admin.ts</code>), ни в списке сотрудников,
          выданном через UI. Подключите нужный кошелёк или попросите текущего админа добавить
          этот адрес на странице «Сотрудники».
        </>
      ) : (
        <>Вы не вошли в аккаунт.</>
      );
    return <p className="p-10 text-neutral-500">Доступ запрещён — {message}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <PageTitle>Админка</PageTitle>
        <p className="mt-1 text-sm text-neutral-400">
          Минимальный инструмент поддержки/тестирования — кошельки, доступ сотрудников, история
          платежей.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-white/10">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 text-sm transition ${
                active
                  ? "border-b-2 border-fuchsia-400 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
