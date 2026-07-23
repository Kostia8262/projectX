import { requireWalletSession } from "@/lib/shop/session";
import { getCharacter } from "@/lib/characters/registry";
import { CARTE_BLANCHE_PRICE } from "@/lib/characters/override";
import { spendCoins } from "@/lib/shop/store";

// Debits real shop coins for a Карт-бланш pass — see characters/override.ts
// for what it unlocks client-side once this succeeds. The client is never
// trusted for its own address; requireWalletSession resolves it from the
// session cookie, same as every other shop route.
export async function POST(request: Request) {
  const session = await requireWalletSession();
  if (!session) {
    return Response.json({ error: "Доступно только для кошелька" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const characterId = typeof body?.characterId === "string" ? body.characterId : null;
  const character = characterId ? getCharacter(characterId) : null;
  if (!character) {
    return Response.json({ error: "Unknown character" }, { status: 404 });
  }

  const result = await spendCoins(session.address, CARTE_BLANCHE_PRICE);
  if (!result.ok) {
    return Response.json({ error: "Недостаточно монет — пополните баланс" }, { status: 402 });
  }

  return Response.json({ balance: result.balance });
}
