import { requireWalletSession } from "@/lib/shop/session";
import { ACCESSORIES } from "@/lib/shop/accessories";
import { activateFreePlanFor, isFreePlanActivatedFor, getOwnedAccessories } from "@/lib/shop/store";

export async function POST() {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json(
      { error: "Подписка пока доступна только для кошелька" },
      { status: 403 }
    );
  }

  const giftIds = ACCESSORIES.filter((a) => a.isRegistrationGift).map((a) => a.id);
  await activateFreePlanFor(session.address, giftIds);
  const owned = await getOwnedAccessories(session.address);
  return Response.json({ activated: true, owned });
}

export async function GET() {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json({ activated: false });
  }
  const activated = await isFreePlanActivatedFor(session.address);
  return Response.json({ activated });
}
