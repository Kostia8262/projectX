// Three-tier access model for admin panel employees. `owner` is the only
// role that can manage other employees or edit game config — both are
// privilege-escalation / content-integrity surfaces, not day-to-day support
// work. `support` covers the actual daily job (Кошельки: coins, accessories,
// subscription overrides). `viewer` is read-only everywhere, for anyone who
// just needs to look something up without being able to touch player data.
// Seed admins (lib/admin.ts's ADMIN_ADDRESSES) are always `owner` — see
// lib/admin/session.ts.
export type EmployeeRole = "owner" | "support" | "viewer";

export const EMPLOYEE_ROLES: EmployeeRole[] = ["owner", "support", "viewer"];

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  owner: "Владелец",
  support: "Саппорт",
  viewer: "Наблюдатель",
};

export const ROLE_DESCRIPTIONS: Record<EmployeeRole, string> = {
  owner: "Полный доступ, включая сотрудников и игры",
  support: "Кошельки (монеты, аксессуары, подписки) — без сотрудников и игр",
  viewer: "Только просмотр, без каких-либо изменений",
};

export function isEmployeeRole(value: unknown): value is EmployeeRole {
  return typeof value === "string" && (EMPLOYEE_ROLES as string[]).includes(value);
}

export function canManageEmployees(role: EmployeeRole): boolean {
  return role === "owner";
}

export function canEditGames(role: EmployeeRole): boolean {
  return role === "owner";
}

export function canManageWallets(role: EmployeeRole): boolean {
  return role === "owner" || role === "support";
}
