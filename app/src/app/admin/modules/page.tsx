"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MODULES, type ModuleId } from "@/lib/modules";
import { SectionHeading } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { BRAND_GRADIENT_CLASS } from "@/components/ui/Button";
import { useAdminWhoAmI } from "@/hooks/useAdminWhoAmI";
import { canEditGames, ROLE_LABELS } from "@/lib/admin/roles";

type ModulesResponse = { disabled: ModuleId[] };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function ModulesPage() {
  const queryClient = useQueryClient();
  const whoAmIQuery = useAdminWhoAmI();

  const modulesQuery = useQuery({
    queryKey: ["admin-modules"],
    queryFn: () => fetchJson<ModulesResponse>("/api/admin/modules"),
  });
  const disabled = new Set(modulesQuery.data?.disabled ?? []);

  const toggle = useMutation({
    mutationFn: ({ moduleId, enabled }: { moduleId: ModuleId; enabled: boolean }) =>
      fetchJson("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
      // Same cache key the public site reads from (hooks/useModules.ts) —
      // keep this tab's toggle visible without a full reload elsewhere.
      queryClient.invalidateQueries({ queryKey: ["modules"] });
    },
  });

  if (whoAmIQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Загрузка…</p>;
  }
  const who = whoAmIQuery.data;
  if (!who?.isAdmin || !canEditGames(who.role)) {
    return (
      <p className="text-sm text-neutral-500">
        Доступ запрещён — управление модулями доступно только роли «{ROLE_LABELS.owner}».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading dense className="mb-2">
          Модули
        </SectionHeading>
        <p className="mb-3 text-xs text-neutral-500">
          Полностью отключает страницу для всех игроков — в шапке пропадает пункт меню, а прямой
          переход на неё возвращает на главную. Полезно на время техработ или переделки раздела.
        </p>
        <Card>
          <div className="flex flex-col gap-3">
            {MODULES.map((m) => {
              const enabled = !disabled.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle.mutate({ moduleId: m.id, enabled: !enabled })}
                  disabled={modulesQuery.isLoading || toggle.isPending}
                  data-testid={`admin-module-${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm text-white">{m.label}</span>
                    <span className="block text-xs text-neutral-500">{m.description}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`text-xs ${enabled ? "text-emerald-400" : "text-neutral-500"}`}>
                      {enabled ? "включена" : "выключена"}
                    </span>
                    <span
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        enabled ? BRAND_GRADIENT_CLASS : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
