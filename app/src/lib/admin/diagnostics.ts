import { getSubscriptionIndexerHealth } from "@/lib/subscriptionIndexer";
import { getCoinIndexerHealth } from "@/lib/shop/coinIndexer";

export type EnvCheck = {
  name: string;
  configured: boolean;
  required: boolean;
  note: string;
};

// Every env var this app reads that silently degrades a feature instead of
// crashing when unset (the project's established convention — see memory).
// That's convenient for users but easy for the admin to lose track of, so
// this is a single "what's actually configured" checklist. Never surfaces
// the VALUES, only presence — this is a diagnostics tool, not a secrets viewer.
function checkEnv(): EnvCheck[] {
  return [
    {
      name: "SUBSCRIPTION_CONTRACT_ADDRESS",
      configured: Boolean(process.env.SUBSCRIPTION_CONTRACT_ADDRESS),
      required: false,
      note: "server indexer — falls back to a local hardhat deploy address if unset",
    },
    {
      name: "NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS",
      configured: Boolean(process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS),
      required: true,
      note: "without it, paid subscription buttons stay disabled",
    },
    {
      name: "COIN_TOPUP_CONTRACT_ADDRESS",
      configured: Boolean(process.env.COIN_TOPUP_CONTRACT_ADDRESS),
      required: true,
      note: "without it, the coin indexer never credits top-ups",
    },
    {
      name: "NEXT_PUBLIC_COIN_TOPUP_CONTRACT_ADDRESS",
      configured: Boolean(process.env.NEXT_PUBLIC_COIN_TOPUP_CONTRACT_ADDRESS),
      required: true,
      note: "without it, the top-up buttons stay disabled",
    },
    {
      name: "NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS",
      configured: Boolean(process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS),
      required: true,
      note: "shared by subscription + coin top-up approve() calls",
    },
    {
      name: "SESSION_SECRET",
      configured: Boolean(process.env.SESSION_SECRET),
      required: true,
      note: "falls back to a hardcoded dev-only secret if unset — never leave unset in production",
    },
    {
      name: "PATREON_CLIENT_ID / PATREON_CLIENT_SECRET",
      configured: Boolean(process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET),
      required: false,
      note: "Patreon login stays hidden without these",
    },
    {
      name: "NEXT_PUBLIC_PATREON_CLIENT_ID",
      configured: Boolean(process.env.NEXT_PUBLIC_PATREON_CLIENT_ID),
      required: false,
      note: "gates whether the Patreon button even renders on AgeGate",
    },
    {
      name: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
      configured: Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
      required: false,
      note: "WalletConnect connector stays hidden without it — optional",
    },
  ];
}

export type AdminDiagnostics = {
  env: EnvCheck[];
  subscriptionIndexer: Awaited<ReturnType<typeof getSubscriptionIndexerHealth>>;
  coinIndexer: Awaited<ReturnType<typeof getCoinIndexerHealth>>;
};

export async function getAdminDiagnostics(): Promise<AdminDiagnostics> {
  const [subscriptionIndexer, coinIndexer] = await Promise.all([
    getSubscriptionIndexerHealth(),
    getCoinIndexerHealth(),
  ]);
  return { env: checkEnv(), subscriptionIndexer, coinIndexer };
}
