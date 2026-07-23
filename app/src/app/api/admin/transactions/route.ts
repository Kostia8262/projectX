import { requireAdminSession } from "@/lib/admin/session";
import { listCoinTopUpLog } from "@/lib/shop/store";
import { listSubscriptionPaymentLog } from "@/lib/subscriptionIndexer";

export type AdminTransaction =
  | { kind: "subscription"; address: string; tierId: number; amount: string; at: number; txHash: string }
  | { kind: "coin-topup"; address: string; coins: number; at: number; txHash: string | null };

// Real payment history, not just current derived state — subscription
// payments and coin top-ups merged into one chronological feed. This is
// what the earlier admin panel was missing: it could show "balance: 810"
// but not "how did they get there."
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const [subs, topUps] = await Promise.all([
    listSubscriptionPaymentLog(100),
    listCoinTopUpLog(100),
  ]);

  const transactions: AdminTransaction[] = [
    ...subs.map((s) => ({
      kind: "subscription" as const,
      address: s.address,
      tierId: s.tierId,
      amount: s.amount,
      at: s.timestamp * 1000,
      txHash: s.txHash,
    })),
    ...topUps.map((t) => ({
      kind: "coin-topup" as const,
      address: t.address,
      coins: t.coins,
      at: t.at,
      txHash: t.ledgerKey.split(":")[0] ?? null,
    })),
  ].sort((a, b) => b.at - a.at);

  return Response.json({ transactions: transactions.slice(0, 100) });
}
