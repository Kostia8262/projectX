"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeRow } from "@/app/api/admin/employees/route";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, SELECT_CLASS } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canManageEmployees, EMPLOYEE_ROLES, ROLE_LABELS, type EmployeeRole } from "@/lib/admin/roles";

type AdminLogEntry = { at: number; admin: string; action: string; address: string; detail: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const whoAmIQuery = useAdminWhoAmI();
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newRole, setNewRole] = useState<EmployeeRole>("support");
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
        body: JSON.stringify({ address: newAddress, label: newLabel, role: newRole }),
      }),
    onSuccess: () => {
      setNewAddress("");
      setNewLabel("");
      setNewRole("support");
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const changeRole = useMutation({
    mutationFn: ({ address, role }: { address: string; role: EmployeeRole }) =>
      fetchJson("/api/admin/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, role }),
      }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  const removeEmployee = useMutation({
    mutationFn: (address: string) =>
      fetchJson(`/api/admin/employees?address=${encodeURIComponent(address)}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Ошибка"),
  });

  if (whoAmIQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Загрузка…</p>;
  }
  const who = whoAmIQuery.data;
  if (!who?.isAdmin || !canManageEmployees(who.role)) {
    return (
      <p className="text-sm text-neutral-500">
        Доступ запрещён — управление сотрудниками доступно только роли «{ROLE_LABELS.owner}».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading dense className="mb-2">
          Сотрудники (доступ в админку)
        </SectionHeading>
        <p className="mb-3 text-xs text-neutral-500">
          «Изначальный список» — жёстко зашитые адреса в <code>lib/admin.ts</code>, их нельзя
          убрать через UI (страховка от случайной блокировки самого себя), роль у них всегда
          «{ROLE_LABELS.owner}». Остальные выданы через эту страницу, хранятся в файле состояния,
          роль можно менять.
        </p>
        <Table columns={["Адрес", "Источник", "Роль", "Метка", "Добавил", "Когда", ""]}>
          {employeesQuery.isLoading && (
            <tr>
              <td className="px-3 py-3 text-neutral-500" colSpan={7}>
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
              <td className="px-3 py-2">
                {e.source === "seed" ? (
                  <span className="text-neutral-400">{ROLE_LABELS[e.role]}</span>
                ) : (
                  <select
                    value={e.role}
                    onChange={(ev) =>
                      changeRole.mutate({ address: e.address, role: ev.target.value as EmployeeRole })
                    }
                    disabled={changeRole.isPending}
                    data-testid={`admin-employee-role-${e.address}`}
                    className={`${SELECT_CLASS} font-sans`}
                  >
                    {EMPLOYEE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
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
                    className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                  >
                    Убрать
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Card>
        <SectionHeading dense className="mb-3">
          Выдать доступ
        </SectionHeading>
        {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x…"
            data-testid="admin-new-employee-address"
            className="flex-1 py-2 font-mono"
          />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="метка (кто это, необязательно)"
            className="flex-1 py-2"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as EmployeeRole)}
            data-testid="admin-new-employee-role"
            className={SELECT_CLASS}
          >
            {EMPLOYEE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <Button
            onClick={() => {
              setError(null);
              addEmployee.mutate();
            }}
            disabled={addEmployee.isPending || !newAddress}
            data-testid="admin-add-employee"
            size="sm"
          >
            {addEmployee.isPending ? "…" : "Добавить"}
          </Button>
        </div>
      </Card>

      <div>
        <SectionHeading dense className="mb-2">
          Журнал действий админов
        </SectionHeading>
        <Table columns={["Когда", "Действие", "Адрес", "Детали"]} scroll="y" className="max-h-64">
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
        </Table>
      </div>
    </div>
  );
}
