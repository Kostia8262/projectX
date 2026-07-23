import { getSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscriptionIndexer";
import { getSubscriptionOverride } from "@/lib/shop/store";

/// Wallet-path subscription status, with an admin-granted override as a
/// fallback when the chain-derived status is inactive. Exists so support/
/// testing (via /admin) can unlock paid-tier content for a wallet without
/// it going through a real on-chain payment — useful right now since
/// testnet funding is still blocked (see memory). The override never wins
/// over a REAL active subscription; it only fills in when there is none.
export async function getEffectiveWalletSubscriptionStatus(
  address: string
): Promise<SubscriptionStatus> {
  const chainStatus = await getSubscriptionStatus(address);
  if (chainStatus.active) return chainStatus;

  const override = await getSubscriptionOverride(address);
  if (!override) return chainStatus;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds >= override.activeUntil) return chainStatus;

  return {
    active: true,
    lastPaidAt: chainStatus.lastPaidAt,
    activeUntil: override.activeUntil,
    tierId: override.tierId,
  };
}
