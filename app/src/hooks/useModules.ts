"use client";

import { useQuery } from "@tanstack/react-query";
import type { ModuleId } from "@/lib/modules";

async function fetchDisabledModules(): Promise<ModuleId[]> {
  const res = await fetch("/api/modules");
  if (!res.ok) return [];
  const data = await res.json();
  return data.disabled ?? [];
}

// Same shared-cache reasoning as useGameOverrides: modules rarely flip
// mid-session, so stale-while-revalidate is fine, and while loading we
// default to "nothing disabled" rather than blocking render on it.
export function useDisabledModules(): Set<ModuleId> {
  const query = useQuery({ queryKey: ["modules"], queryFn: fetchDisabledModules });
  return new Set(query.data ?? []);
}

export function useModuleEnabled(moduleId: ModuleId): boolean {
  return !useDisabledModules().has(moduleId);
}
