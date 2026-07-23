"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACCESSORIES, getAccessory } from "@/lib/shop/accessories";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";
import type { AdminUserRow } from "@/app/api/admin/users/route";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const PAID_TIERS = SUBSCRIPTION_TIERS.filter((t) => !t.isFree);

function tierName(tierId: number): string {
  return SUBSCRIPTION_TIERS.find((t) => t.contractTierId === tierId)?.name ?? `#${tierId}`;
}

function subscriptionSourceLabel(source: AdminUserRow["subscriptionSource"]): string {
  if (source === "admin-override") return "выдано вручную";
  if (source === "free-plan") return "бесплатный тариф";
  if (source === "chain") return "ончейн";
  return "";
}

export default function WalletsPage() {
  const queryClient = useQueryClient();
  const [selectedAddress, setSelectedAddress] = useState("");
  const [coinAmount, setCoinAmount] = useState("100");
  const [accessoryId, setAccessoryId] = useState(ACCESSORIES[0]?.id ?? "");
  const [tierId, setTierId] = useState(PAID_TIERS[0]?.contractTierId ?? 1);
  const [days, setDays] = useState("30");
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson<{ users: AdminUserRow[] }>("/api/admin/users"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
  }

  function postJson(url: string, body: unknown) {
    return fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function deleteJson(url: string, body: unknown) {
    return fetchJson(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const grantCoins = useMutation({
    mutationFn: () => postJson("/api/admin/grant-coins", { address: selectedAddress, amount: Number(coinAmount) }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const deductCoins = useMutation({
    mutationFn: () => deleteJson("/api/admin/grant-coins", { address: selectedAddress, amount: Number(coinAmount) }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const grantAccessory = useMutation({
    mutationFn: () => postJson("/api/admin/grant-accessory", { address: selectedAddress, accessoryId }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const revokeAccessory = useMutation({
    mutationFn: (id: string) => deleteJson("/api/admin/grant-accessory", { address: selectedAddress, accessoryId: id }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const grantSubscription = useMutation({
    mutationFn: () => postJson("/api/admin/subscription-override", { address: selectedAddress, tierId, days: Number(days) }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const clearSubscription = useMutation({
    mutationFn: () =>
      fetchJson(`/api/admin/subscription-override?address=${encodeURIComponent(selectedAddress)}`, {
        method: "DELETE",
      }),
    onSuccess: invalidateAll,
    onError: (err) => setActionError(err instanceof Error ? err.message : "Ошибка"),
  });

  const selectedUser = usersQuery.data?.users.find((u) => u.address === selectedAddress.toLowerCase());

  function runAction(fn: () => void) {
    setActionError(null);
    if (!selectedAddress) {
      setActionError("Сначала укажите адрес");
      return;
    }
    fn();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-white">Кошельки</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-neutral-400">
              <tr>
                <th className="px-3 py-2">Адрес</th>
                <th className="px-3 py-2">Монеты</th>
                <th className="px-3 py-2">Аксессуаров</th>
                <th className="px-3 py-2">Free-план</th>
                <th className="px-3 py-2">Подписка</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                    Загрузка…
                  </td>
                </tr>
              )}
              {usersQuery.data?.users.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                    Пока ни один адрес не оставил следов в магазине/подписке.
                  </td>
                </tr>
              )}
              {usersQuery.data?.users.map((u) => (
                <tr
                  key={u.address}
                  onClick={() => setSelectedAddress(u.address)}
                  data-testid={`admin-user-${u.address}`}
                  className={`cursor-pointer border-t border-white/5 font-mono hover:bg-white/[0.04] ${
                    selectedAddress.toLowerCase() === u.address ? "bg-fuchsia-500/10" : ""
                  }`}
                >
                  <td className="px-3 py-2">{u.address}</td>
                  <td className="px-3 py-2">{u.balance}</td>
                  <td className="px-3 py-2">{u.ownedIds.length}</td>
                  <td className="px-3 py-2">{u.freePlanActivated ? "да" : "нет"}</td>
                  <td className="px-3 py-2">
                    {u.subscription ? (
                      <span className={u.subscription.active ? "text-emerald-400" : "text-neutral-500"}>
                        {tierName(u.subscription.tierId)}
                        {u.subscription.active ? " (активна" : " (истекла"}
                        {u.subscriptionSource && u.subscriptionSource !== "chain"
                          ? `, ${subscriptionSourceLabel(u.subscriptionSource)})`
                          : ")"}
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Управление адресом</h2>
        <input
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(e.target.value)}
          placeholder="0x…"
          data-testid="admin-address-input"
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-white outline-none focus:border-fuchsia-400/50"
        />
        {selectedUser?.subscription && (
          <p className="mb-3 text-xs text-neutral-400">
            Сейчас: {tierName(selectedUser.subscription.tierId)},{" "}
            {selectedUser.subscription.active ? "активна" : "истекла"}
            {selectedUser.subscriptionSource
              ? ` (${subscriptionSourceLabel(selectedUser.subscriptionSource)})`
              : ""}
          </p>
        )}
        {selectedUser && selectedUser.ownedIds.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {selectedUser.ownedIds.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-300"
              >
                {getAccessory(id)?.name ?? id}
                <button
                  onClick={() => revokeAccessory.mutate(id)}
                  disabled={revokeAccessory.isPending}
                  data-testid={`admin-revoke-${id}`}
                  title="Отозвать"
                  className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {actionError && <p className="mb-3 text-xs text-rose-400">{actionError}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400">Монеты</label>
            <input
              type="number"
              min={1}
              value={coinAmount}
              onChange={(e) => setCoinAmount(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => runAction(() => grantCoins.mutate())}
                disabled={grantCoins.isPending}
                data-testid="admin-grant-coins"
                className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {grantCoins.isPending ? "…" : "Начислить"}
              </button>
              <button
                onClick={() => runAction(() => deductCoins.mutate())}
                disabled={deductCoins.isPending}
                data-testid="admin-deduct-coins"
                className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 disabled:opacity-50"
              >
                {deductCoins.isPending ? "…" : "Списать"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400">Выдать аксессуар</label>
            <select
              value={accessoryId}
              onChange={(e) => setAccessoryId(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white outline-none"
            >
              {ACCESSORIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => runAction(() => grantAccessory.mutate())}
              disabled={grantAccessory.isPending}
              data-testid="admin-grant-accessory"
              className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {grantAccessory.isPending ? "…" : "Выдать аксессуар"}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400">Выдать подписку (override)</label>
            <div className="flex gap-2">
              <select
                value={tierId}
                onChange={(e) => setTierId(Number(e.target.value))}
                className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white outline-none"
              >
                {PAID_TIERS.map((t) => (
                  <option key={t.id} value={t.contractTierId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                title="дней"
                className="w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runAction(() => grantSubscription.mutate())}
                disabled={grantSubscription.isPending}
                data-testid="admin-grant-subscription"
                className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {grantSubscription.isPending ? "…" : "Выдать"}
              </button>
              <button
                onClick={() => runAction(() => clearSubscription.mutate())}
                disabled={clearSubscription.isPending}
                data-testid="admin-clear-subscription"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30"
              >
                Снять
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
