import { requireWalletSession } from "@/lib/shop/session";
import { spendCoins } from "@/lib/shop/store";
import { ENERGY_REFILL_COST_COINS } from "@/lib/shop/coinConfig";

// Energy itself stays client-side/free (see games/energy.ts) — this only
// authorizes the shortcut. Coins are the real, server-tracked economy, so
// the debit has to happen here, not in the client.
export async function POST() {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json(
      { error: "Восполнение за монеты пока доступно только для кошелька" },
      { status: 403 }
    );
  }

  const result = await spendCoins(session.address, ENERGY_REFILL_COST_COINS);
  if (!result.ok) {
    return Response.json({ error: "Недостаточно монет" }, { status: 400 });
  }

  return Response.json({ ok: true, balance: result.balance });
}
