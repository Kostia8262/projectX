"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACCESSORIES, getAccessory } from "@/lib/shop/accessories";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";
import type { AdminUserRow } from "@/app/api/admin/users/route";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FORM_CONTROL_CLASS } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canManageWallets, ROLE_LABELS } from "@/lib/admin/roles";

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
  const whoAmIQuery = useAdminWhoAmI();
  const canManage = whoAmIQuery.data?.isAdmin && canManageWallets(whoAmIQuery.data.role);
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
        <SectionHeading dense className="mb-2">
          Кошельки
        </SectionHeading>
        <Table columns={["Адрес", "Монеты", "Аксессуаров", "Free-план", "Подписка"]}>
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
        </Table>
      </div>

      {canManage ? (
      <Card>
        <SectionHeading dense className="mb-3">
          Управление адресом
        </SectionHeading>
        <Input
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(e.target.value)}
          placeholder="0x…"
          data-testid="admin-address-input"
          className="mb-4 w-full py-2 font-mono"
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
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-neutral-300"
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
            <Input
              type="number"
              min={1}
              value={coinAmount}
              onChange={(e) => setCoinAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => runAction(() => grantCoins.mutate())}
                disabled={grantCoins.isPending}
                data-testid="admin-grant-coins"
                size="sm"
                className="flex-1"
              >
                {grantCoins.isPending ? "…" : "Начислить"}
              </Button>
              <Button
                onClick={() => runAction(() => deductCoins.mutate())}
                disabled={deductCoins.isPending}
                data-testid="admin-deduct-coins"
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                {deductCoins.isPending ? "…" : "Списать"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400">Выдать аксессуар</label>
            <select
              value={accessoryId}
              onChange={(e) => setAccessoryId(e.target.value)}
              className={FORM_CONTROL_CLASS}
            >
              {ACCESSORIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button
              onClick={() => runAction(() => grantAccessory.mutate())}
              disabled={grantAccessory.isPending}
              data-testid="admin-grant-accessory"
              size="sm"
            >
              {grantAccessory.isPending ? "…" : "Выдать аксессуар"}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400">Выдать подписку (override)</label>
            <div className="flex gap-2">
              <select
                value={tierId}
                onChange={(e) => setTierId(Number(e.target.value))}
                className={`flex-1 ${FORM_CONTROL_CLASS}`}
              >
                {PAID_TIERS.map((t) => (
                  <option key={t.id} value={t.contractTierId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                title="дней"
                className="w-16"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => runAction(() => grantSubscription.mutate())}
                disabled={grantSubscription.isPending}
                data-testid="admin-grant-subscription"
                size="sm"
                className="flex-1"
              >
                {grantSubscription.isPending ? "…" : "Выдать"}
              </Button>
              <Button
                onClick={() => runAction(() => clearSubscription.mutate())}
                disabled={clearSubscription.isPending}
                data-testid="admin-clear-subscription"
                variant="secondary"
                size="sm"
              >
                Снять
              </Button>
            </div>
          </div>
        </div>
      </Card>
      ) : whoAmIQuery.isLoading ? null : (
        <p className="text-sm text-neutral-500">
          Действия с кошельком (монеты, аксессуары, подписка) недоступны роли «{ROLE_LABELS.viewer}».
        </p>
      )}
    </div>
  );
}
