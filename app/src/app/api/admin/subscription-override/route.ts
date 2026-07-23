import { isAddress } from "viem";
import { requireAdminSession } from "@/lib/admin/session";
import { getTierByContractId } from "@/lib/subscription/tiers";
import { setSubscriptionOverride, clearSubscriptionOverride } from "@/lib/shop/store";

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address : null;
  const tierId = typeof body?.tierId === "number" ? body.tierId : null;
  const days = typeof body?.days === "number" ? body.days : null;
  if (!address || !isAddress(address) || tierId === null || !days || days <= 0) {
    return Response.json({ error: "Invalid address, tierId or days" }, { status: 400 });
  }
  const tier = getTierByContractId(tierId);
  if (!tier || tier.isFree) {
    return Response.json({ error: "Unknown paid tier" }, { status: 400 });
  }

  const activeUntil = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  await setSubscriptionOverride(admin.address, address, tierId, activeUntil);
  return Response.json({ ok: true, tierId, activeUntil });
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

  await clearSubscriptionOverride(admin.address, address);
  return Response.json({ ok: true });
}
