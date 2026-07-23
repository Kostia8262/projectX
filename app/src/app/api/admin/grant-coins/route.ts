import { isAddress } from "viem";
import { requireAdminRole } from "@/lib/admin/session";
import { canManageWallets } from "@/lib/admin/roles";
import { adminCreditCoins, adminDeductCoins } from "@/lib/shop/store";

function parseBody(body: unknown): { address: string; amount: number } | null {
  const address = typeof (body as { address?: unknown })?.address === "string" ? (body as { address: string }).address : null;
  const amount = typeof (body as { amount?: unknown })?.amount === "number" ? (body as { amount: number }).amount : null;
  if (!address || !isAddress(address) || !amount || amount <= 0 || !Number.isFinite(amount)) {
    return null;
  }
  return { address, amount: Math.floor(amount) };
}

export async function POST(request: Request) {
  const admin = await requireAdminRole(canManageWallets);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) {
    return Response.json({ error: "Invalid address or amount" }, { status: 400 });
  }

  const balance = await adminCreditCoins(admin.address, parsed.address, parsed.amount);
  return Response.json({ balance });
}

/// Deduct coins — clamped at 0, never goes negative. Same body shape as
/// POST, just the opposite direction; a support/testing "undo" for
/// grant-coins.
export async function DELETE(request: Request) {
  const admin = await requireAdminRole(canManageWallets);
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) {
    return Response.json({ error: "Invalid address or amount" }, { status: 400 });
  }

  const balance = await adminDeductCoins(admin.address, parsed.address, parsed.amount);
  return Response.json({ balance });
}
