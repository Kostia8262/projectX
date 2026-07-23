import { createPublicClient, http, type Address } from "viem";
import { creditTopUp } from "@/lib/shop/store";
import { getTopUpPackage } from "@/lib/shop/coinConfig";

// Same shape as subscriptionIndexer.ts: scan `CoinsPurchased` events and
// mirror them into server-side state. Unlike subscription status (purely
// re-derived from the latest event every time), coin balances are spent
// off-chain too, so each top-up log must be credited exactly once — hence
// `creditTopUp`'s idempotency guard keyed by `${txHash}:${logIndex}`,
// instead of just tracking "last synced block" the way the subscription
// indexer does.
//
// Coins credited come from `getTopUpPackage(packageId).coins` — the coin
// count (including the bulk-discount bonus) is entirely an off-chain
// decision, the contract only ever emits which package id was bought.
const COINS_PURCHASED_EVENT = {
  type: "event",
  name: "CoinsPurchased",
  inputs: [
    { name: "buyer", type: "address", indexed: true },
    { name: "packageId", type: "uint8", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
} as const;

const RPC_URL = process.env.COIN_TOPUP_RPC_URL ?? process.env.SUBSCRIPTION_RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.COIN_TOPUP_CONTRACT_ADDRESS as Address | undefined;
const DEPLOYMENT_BLOCK = BigInt(process.env.COIN_TOPUP_DEPLOYMENT_BLOCK ?? "0");

if (!CONTRACT_ADDRESS && process.env.NODE_ENV !== "production") {
  console.warn(
    "[coinIndexer] COIN_TOPUP_CONTRACT_ADDRESS is not set — coin top-ups will never be credited " +
      "until it's set in .env.local."
  );
}

const client = createPublicClient({ transport: http(RPC_URL) });

let lastSyncedBlock: bigint = DEPLOYMENT_BLOCK - BigInt(1);
if (lastSyncedBlock < BigInt(0)) lastSyncedBlock = BigInt(0);
let syncPromise: Promise<void> | null = null;

async function sync(): Promise<void> {
  if (!CONTRACT_ADDRESS) return;

  const latestBlock = await client.getBlockNumber();
  if (latestBlock <= lastSyncedBlock) return;

  const fromBlock = lastSyncedBlock === BigInt(0) ? BigInt(0) : lastSyncedBlock + BigInt(1);
  const logs = await client.getLogs({
    address: CONTRACT_ADDRESS,
    event: COINS_PURCHASED_EVENT,
    fromBlock,
    toBlock: latestBlock,
  });

  for (const log of logs) {
    const buyer = log.args.buyer;
    const packageId = log.args.packageId;
    if (!buyer || packageId === undefined) continue;

    const pkg = getTopUpPackage(packageId);
    if (!pkg) continue; // an on-chain package id with no off-chain match — shouldn't happen, skip rather than guess

    const ledgerKey = `${log.transactionHash}:${log.logIndex}`;
    await creditTopUp(buyer, pkg.coins, ledgerKey);
  }

  lastSyncedBlock = latestBlock;
}

// Collapse concurrent callers into a single in-flight sync instead of each
// triggering their own getLogs scan.
async function syncOnce(): Promise<void> {
  if (!syncPromise) {
    syncPromise = sync().finally(() => {
      syncPromise = null;
    });
  }
  return syncPromise;
}

export async function syncCoinTopUps(): Promise<void> {
  await syncOnce();
}

export type CoinIndexerHealth = {
  contractAddress: string | null;
  rpcUrl: string;
  lastSyncedBlock: string;
  rpcReachable: boolean;
};

/// For the admin diagnostics panel — see subscriptionIndexer.ts's twin.
export async function getCoinIndexerHealth(): Promise<CoinIndexerHealth> {
  let rpcReachable = true;
  try {
    await client.getBlockNumber();
  } catch {
    rpcReachable = false;
  }
  return {
    contractAddress: CONTRACT_ADDRESS ?? null,
    rpcUrl: RPC_URL,
    lastSyncedBlock: lastSyncedBlock.toString(),
    rpcReachable,
  };
}
