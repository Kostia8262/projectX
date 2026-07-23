"use client";

import { useQuery } from "@tanstack/react-query";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";
import type { AdminTransaction } from "@/app/api/admin/transactions/route";
import type { AdminDiagnostics } from "@/lib/admin/diagnostics";
import { SectionHeading } from "@/components/ui/Heading";
import { Tile } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function tierName(tierId: number): string {
  return SUBSCRIPTION_TIERS.find((t) => t.contractTierId === tierId)?.name ?? `#${tierId}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function TransactionsPage() {
  const transactionsQuery = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => fetchJson<{ transactions: AdminTransaction[] }>("/api/admin/transactions"),
  });
  const diagnosticsQuery = useQuery({
    queryKey: ["admin-diagnostics"],
    queryFn: () => fetchJson<AdminDiagnostics>("/api/admin/diagnostics"),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading dense className="mb-2">
          История платежей
        </SectionHeading>
        <p className="mb-2 text-xs text-neutral-500">
          Реальные ончейн-события (подписки и топ-апы монет), а не текущий баланс — до 100
          последних.
        </p>
        <Table
          columns={["Когда", "Тип", "Адрес", "Детали", "Tx"]}
          scroll="y"
          className="max-h-96"
        >
          {transactionsQuery.isLoading && (
            <tr>
              <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                Загрузка…
              </td>
            </tr>
          )}
          {transactionsQuery.data?.transactions.length === 0 && (
            <tr>
              <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                Пока пусто — ни одной подписки или топ-апа монет ончейн.
              </td>
            </tr>
          )}
          {transactionsQuery.data?.transactions.map((tx, i) => (
            <tr key={i} className="border-t border-white/5 font-mono text-neutral-400">
              <td className="px-3 py-2">{new Date(tx.at).toLocaleString("ru-RU")}</td>
              <td className="px-3 py-2">
                {tx.kind === "subscription" ? "подписка" : "топ-ап монет"}
              </td>
              <td className="px-3 py-2">{shortAddress(tx.address)}</td>
              <td className="px-3 py-2">
                {tx.kind === "subscription"
                  ? `${tierName(tx.tierId)}, ${tx.amount}`
                  : `+${tx.coins} монет`}
              </td>
              <td className="px-3 py-2">{tx.txHash ? shortAddress(tx.txHash) : "—"}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div>
        <SectionHeading dense className="mb-2">
          Диагностика конфигурации
        </SectionHeading>
        <p className="mb-2 text-xs text-neutral-500">
          Что из платёжной инфраструктуры реально настроено на этом окружении — значения не
          показываются, только факт наличия. Полезно смотреть сюда, если история выше выглядит
          пустой неожиданно.
        </p>
        <Table columns={["Переменная", "Статус", "Комментарий"]}>
          {diagnosticsQuery.data?.env.map((check) => (
            <tr key={check.name} className="border-t border-white/5">
              <td className="px-3 py-2 font-mono text-neutral-300">{check.name}</td>
              <td className="px-3 py-2">
                {check.configured ? (
                  <span className="text-emerald-400">настроено</span>
                ) : check.required ? (
                  <span className="text-rose-400">не настроено</span>
                ) : (
                  <span className="text-neutral-500">не настроено (опционально)</span>
                )}
              </td>
              <td className="px-3 py-2 text-neutral-500">{check.note}</td>
            </tr>
          ))}
        </Table>
        {diagnosticsQuery.data && (
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-neutral-400 sm:grid-cols-2">
            <Tile size="md">
              <p className="mb-1 font-medium text-neutral-300">Индексер подписки</p>
              <p>RPC: {diagnosticsQuery.data.subscriptionIndexer.rpcUrl}</p>
              <p>
                Доступен:{" "}
                {diagnosticsQuery.data.subscriptionIndexer.rpcReachable ? (
                  <span className="text-emerald-400">да</span>
                ) : (
                  <span className="text-rose-400">нет</span>
                )}
              </p>
              <p>Последний блок: {diagnosticsQuery.data.subscriptionIndexer.lastSyncedBlock}</p>
            </Tile>
            <Tile size="md">
              <p className="mb-1 font-medium text-neutral-300">Индексер монет</p>
              <p>RPC: {diagnosticsQuery.data.coinIndexer.rpcUrl}</p>
              <p>
                Доступен:{" "}
                {diagnosticsQuery.data.coinIndexer.rpcReachable ? (
                  <span className="text-emerald-400">да</span>
                ) : (
                  <span className="text-rose-400">нет</span>
                )}
              </p>
              <p>Последний блок: {diagnosticsQuery.data.coinIndexer.lastSyncedBlock}</p>
            </Tile>
          </div>
        )}
      </div>
    </div>
  );
}
