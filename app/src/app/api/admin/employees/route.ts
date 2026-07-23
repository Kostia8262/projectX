import { isAddress } from "viem";
import { requireAdminRole } from "@/lib/admin/session";
import { canManageEmployees, isEmployeeRole, type EmployeeRole } from "@/lib/admin/roles";
import { ADMIN_ADDRESSES_FOR_DISPLAY } from "@/lib/admin";
import {
  listGrantedAdmins,
  addGrantedAdmin,
  removeGrantedAdmin,
  setGrantedAdminRole,
} from "@/lib/shop/store";

export type EmployeeRow = {
  address: string;
  source: "seed" | "granted";
  label: string;
  addedBy: string | null;
  addedAt: number | null;
  role: EmployeeRole;
};

// Managing who has admin access — and what they can do with it — is itself
// an owner-only capability. A "support" or "viewer" employee doesn't get to
// see this page at all, not just the mutation buttons.
export async function GET() {
  const admin = await requireAdminRole(canManageEmployees);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const granted = await listGrantedAdmins();
  const rows: EmployeeRow[] = [
    ...ADMIN_ADDRESSES_FOR_DISPLAY.map((address) => ({
      address,
      source: "seed" as const,
      label: "изначальный список (lib/admin.ts)",
      addedBy: null,
      addedAt: null,
      role: "owner" as const,
    })),
    ...granted.map((g) => ({
      address: g.address,
      source: "granted" as const,
      label: g.label || "—",
      addedBy: g.addedBy,
      addedAt: g.addedAt,
      role: g.role,
    })),
  ];
  return Response.json({ employees: rows });
}

export async function POST(request: Request) {
  const admin = await requireAdminRole(canManageEmployees);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address : null;
  const label = typeof body?.label === "string" ? body.label : "";
  const role = isEmployeeRole(body?.role) ? body.role : null;
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  await addGrantedAdmin(admin.address, address, label, role);
  return Response.json({ ok: true });
}

// Changes an existing employee's role. Not available for seed admins — they
// aren't in the granted-admin store and are always "owner" (see
// requireAdminSession); nothing to change through the UI.
export async function PATCH(request: Request) {
  const admin = await requireAdminRole(canManageEmployees);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address : null;
  const role = isEmployeeRole(body?.role) ? body.role : null;
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  if (ADMIN_ADDRESSES_FOR_DISPLAY.includes(address.toLowerCase())) {
    return Response.json(
      { error: "У изначального админа из lib/admin.ts роль всегда «владелец»" },
      { status: 400 }
    );
  }

  const changed = await setGrantedAdminRole(admin.address, address, role);
  return Response.json({ changed });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminRole(canManageEmployees);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Missing or invalid address" }, { status: 400 });
  }
  if (ADMIN_ADDRESSES_FOR_DISPLAY.includes(address.toLowerCase())) {
    return Response.json(
      { error: "Нельзя убрать изначального админа из lib/admin.ts через UI" },
      { status: 400 }
    );
  }

  const removed = await removeGrantedAdmin(admin.address, address);
  return Response.json({ removed });
}
