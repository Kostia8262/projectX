import { isAddress } from "viem";
import { requireAdminRole } from "@/lib/admin/session";
import { canManageWallets } from "@/lib/admin/roles";
import { getAccessory } from "@/lib/shop/accessories";
import { adminGrantAccessory, adminRevokeAccessory } from "@/lib/shop/store";

function parseBody(body: unknown): { address: string; accessoryId: string } | null {
  const address = typeof (body as { address?: unknown })?.address === "string" ? (body as { address: string }).address : null;
  const accessoryId =
    typeof (body as { accessoryId?: unknown })?.accessoryId === "string"
      ? (body as { accessoryId: string }).accessoryId
      : null;
  if (!address || !isAddress(address) || !accessoryId) return null;
  return { address, accessoryId };
}

export async function POST(request: Request) {
  const admin = await requireAdminRole(canManageWallets);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) {
    return Response.json({ error: "Invalid address or accessoryId" }, { status: 400 });
  }
  if (!getAccessory(parsed.accessoryId)) {
    return Response.json({ error: "Unknown accessory" }, { status: 404 });
  }

  const result = await adminGrantAccessory(admin.address, parsed.address, parsed.accessoryId);
  return Response.json(result);
}

export async function DELETE(request: Request) {
  const admin = await requireAdminRole(canManageWallets);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) {
    return Response.json({ error: "Invalid address or accessoryId" }, { status: 400 });
  }

  const result = await adminRevokeAccessory(admin.address, parsed.address, parsed.accessoryId);
  return Response.json(result);
}
