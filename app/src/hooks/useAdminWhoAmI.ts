"use client";

import { useQuery } from "@tanstack/react-query";
import type { EmployeeRole } from "@/lib/admin/roles";

export type WhoAmI =
  | { isAdmin: true; address: string; role: EmployeeRole }
  | { isAdmin: false; reason: "no-session" }
  | { isAdmin: false; reason: "not-wallet"; address: string }
  | { isAdmin: false; reason: "not-admin"; address: string };

async function fetchWhoAmI(): Promise<WhoAmI> {
  const res = await fetch("/api/admin/whoami");
  return res.json();
}

// Same queryKey used by every admin page that needs to know the current
// employee's role (layout's tab visibility, per-page action gating) — one
// shared cache entry via react-query, not a fetch per page.
export function useAdminWhoAmI() {
  return useQuery({ queryKey: ["admin-whoami"], queryFn: fetchWhoAmI });
}
