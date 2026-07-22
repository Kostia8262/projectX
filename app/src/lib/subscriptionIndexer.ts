import { createPublicClient, http, type Address } from "viem";

// Minimal ABI fragment — just what the indexer needs to decode the one
// event it cares about. Kept as a plain array here rather than importing
// the full artifact from the separate `contracts/` package.
const SUBSCRIPTION_PAID_EVENT = {
  type: "event",
  name: "SubscriptionPaid",
  inputs: [
    { name: "subscriber", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
} as const;

const RPC_URL = process.env.SUBSCRIPTION_RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = (process.env.SUBSCRIPTION_CONTRACT_ADDRESS ??
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as Address;
const SUBSCRIPTION_PERIOD_SECONDS =
  Number(process.env.SUBSCRIPTION_PERIOD_DAYS ?? "30") * 24 * 60 * 60;
// Local dev networks start from block 0 with no prior history; a real
// testnet/mainnet deployment should set this to the contract's deployment
// block so the indexer doesn't have to scan from genesis.
const DEPLOYMENT_BLOCK = BigInt(process.env.SUBSCRIPTION_DEPLOYMENT_BLOCK ?? "0");

const client = createPublicClient({ transport: http(RPC_URL) });

// address (lowercased) -> last payment's on-chain timestamp (unix seconds)
const lastPaidAt = new Map<string, number>();
let lastSyncedBlock: bigint = DEPLOYMENT_BLOCK - 1n;
if (lastSyncedBlock < 0n) lastSyncedBlock = 0n;
let syncPromise: Promise<void> | null = null;

async function sync(): Promise<void> {
  const latestBlock = await client.getBlockNumber();
  if (latestBlock <= lastSyncedBlock) return;

  const fromBlock = lastSyncedBlock === 0n ? 0n : lastSyncedBlock + 1n;
  const logs = await client.getLogs({
    address: CONTRACT_ADDRESS,
    event: SUBSCRIPTION_PAID_EVENT,
    fromBlock,
    toBlock: latestBlock,
  });

  for (const log of logs) {
    const subscriber = log.args.subscriber?.toLowerCase();
    const timestamp = log.args.timestamp;
    if (!subscriber || timestamp === undefined) continue;
    const ts = Number(timestamp);
    const existing = lastPaidAt.get(subscriber) ?? 0;
    if (ts > existing) lastPaidAt.set(subscriber, ts);
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

export type SubscriptionStatus = {
  active: boolean;
  lastPaidAt: number | null;
  activeUntil: number | null;
};

export async function getSubscriptionStatus(
  address: string
): Promise<SubscriptionStatus> {
  await syncOnce();

  const paidAt = lastPaidAt.get(address.toLowerCase()) ?? null;
  if (paidAt === null) {
    return { active: false, lastPaidAt: null, activeUntil: null };
  }

  const activeUntil = paidAt + SUBSCRIPTION_PERIOD_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return { active: nowSeconds < activeUntil, lastPaidAt: paidAt, activeUntil };
}
