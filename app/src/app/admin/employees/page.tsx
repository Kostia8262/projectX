"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeRow } from "@/app/api/admin/employees/route";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AdminLogEntry = { at: number; admin: string; action: string; address: string; detail: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => fetchJson<{ employees: EmployeeRow[] }>("/api/admin/employees"),
  });
  const logQuery = useQuery({
    queryKey: ["admin-log"],
    queryFn: () => fetchJson<{ log: AdminLogEntry[] }>("/api/admin/log"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
    queryClient.invalidateQueries({ queryKey: ["admin-log"] });
  }

  const addEmployee = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newAddress, label: newLabel }),
      }),
    onSuccess: () => {
      setNewAddress("");
      setNewLabel("");
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const removeEmployee = useMutation({
    mutationFn: (address: string) =>
      fetchJson(`/api/admin/employees?address=${encodeURIComponent(address)}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading dense className="mb-2">
          Сотрудники (доступ в админку)
        </SectionHeading>
        <p className="mb-3 text-xs text-neutral-500">
          «Изначальный список» — жёстко зашитые адреса в <code>lib/admin.ts</code>, их нельзя
          убрать через UI (страховка от случайной блокировки самого себя). Остальные выданы через
          эту страницу и хранятся в файле состояния.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-neutral-400">
              <tr>
                <th className="px-3 py-2">Адрес</th>
                <th className="px-3 py-2">Источник</th>
                <th className="px-3 py-2">Метка</th>
                <th className="px-3 py-2">Добавил</th>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {employeesQuery.isLoading && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={6}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {employeesQuery.data?.employees.map((e) => (
                <tr key={e.address} className="border-t border-white/5 font-mono text-neutral-300">
                  <td className="px-3 py-2">{e.address}</td>
                  <td className="px-3 py-2">
                    {e.source === "seed" ? (
                      <span className="text-neutral-500">изначальный</span>
                    ) : (
                      <span className="text-emerald-400">выдан</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{e.label}</td>
                  <td className="px-3 py-2">{e.addedBy ?? "—"}</td>
                  <td className="px-3 py-2">
                    {e.addedAt ? new Date(e.addedAt).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {e.source === "granted" && (
                      <button
                        onClick={() => removeEmployee.mutate(e.address)}
                        disabled={removeEmployee.isPending}
                        data-testid={`admin-remove-employee-${e.address}`}
                        className="font-sans text-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        Убрать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Выдать доступ</h2>
        {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x…"
            data-testid="admin-new-employee-address"
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-white outline-none focus:border-fuchsia-400/50"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="метка (кто это, необязательно)"
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-fuchsia-400/50"
          />
          <button
            onClick={() => {
              setError(null);
              addEmployee.mutate();
            }}
            disabled={addEmployee.isPending || !newAddress}
            data-testid="admin-add-employee"
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {addEmployee.isPending ? "…" : "Добавить"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-white">Журнал действий админов</h2>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-neutral-400">
              <tr>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Действие</th>
                <th className="px-3 py-2">Адрес</th>
                <th className="px-3 py-2">Детали</th>
              </tr>
            </thead>
            <tbody>
              {logQuery.data?.log.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={4}>
                    Пока пусто.
                  </td>
                </tr>
              )}
              {logQuery.data?.log.map((entry, i) => (
                <tr key={i} className="border-t border-white/5 font-mono text-neutral-400">
                  <td className="px-3 py-2">{new Date(entry.at).toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-2">{entry.action}</td>
                  <td className="px-3 py-2">{entry.address}</td>
                  <td className="px-3 py-2">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
