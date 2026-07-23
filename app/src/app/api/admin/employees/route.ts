import { isAddress } from "viem";
import { requireAdminSession } from "@/lib/admin/session";
import { ADMIN_ADDRESSES_FOR_DISPLAY } from "@/lib/admin";
import { listGrantedAdmins, addGrantedAdmin, removeGrantedAdmin } from "@/lib/shop/store";

export type EmployeeRow = {
  address: string;
  source: "seed" | "granted";
  label: string;
  addedBy: string | null;
  addedAt: number | null;
};

export async function GET() {
  const admin = await requireAdminSession();
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
    })),
    ...granted.map((g) => ({
      address: g.address,
      source: "granted" as const,
      label: g.label || "—",
      addedBy: g.addedBy,
      addedAt: g.addedAt,
    })),
  ];
  return Response.json({ employees: rows });
}

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address : null;
  const label = typeof body?.label === "string" ? body.label : "";
  if (!address || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  await addGrantedAdmin(admin.address, address, label);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminSession();
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
