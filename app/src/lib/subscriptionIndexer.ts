import { createPublicClient, http, type Address } from "viem";

// Minimal ABI fragment — just what the indexer needs to decode the one
// event it cares about. Kept as a plain array here rather than importing
// the full artifact from the separate `contracts/` package.
const SUBSCRIPTION_PAID_EVENT = {
  type: "event",
  name: "SubscriptionPaid",
  inputs: [
    { name: "subscriber", type: "address", indexed: true },
    { name: "tierId", type: "uint8", indexed: true },
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

// address (lowercased) -> most recent payment's tier + timestamp. Tracking
// the tier alongside the timestamp (not just "last paid at") is what lets
// downstream consumers (shop discount, energy regen bonus, exclusive
// accessories) know WHICH tier is active, not just whether one is.
type LastPayment = { tierId: number; timestamp: number };
const lastPayment = new Map<string, LastPayment>();

// Full payment history (as opposed to `lastPayment`, which only keeps the
// latest per address) — for the admin transaction log. `processedLogKeys`
// guards against duplicate entries on a process restart, since a restart
// resets `lastSyncedBlock` and rescans from `DEPLOYMENT_BLOCK`.
export type SubscriptionPaymentLogEntry = {
  address: string;
  tierId: number;
  amount: string;
  timestamp: number;
  txHash: string;
};
const paymentLog: SubscriptionPaymentLogEntry[] = [];
const processedLogKeys = new Set<string>();
const PAYMENT_LOG_MAX_ENTRIES = 500;

let lastSyncedBlock: bigint = DEPLOYMENT_BLOCK - BigInt(1);
if (lastSyncedBlock < BigInt(0)) lastSyncedBlock = BigInt(0);
let syncPromise: Promise<void> | null = null;

async function sync(): Promise<void> {
  const latestBlock = await client.getBlockNumber();
  if (latestBlock <= lastSyncedBlock) return;

  const fromBlock = lastSyncedBlock === BigInt(0) ? BigInt(0) : lastSyncedBlock + BigInt(1);
  const logs = await client.getLogs({
    address: CONTRACT_ADDRESS,
    event: SUBSCRIPTION_PAID_EVENT,
    fromBlock,
    toBlock: latestBlock,
  });

  for (const log of logs) {
    const subscriber = log.args.subscriber?.toLowerCase();
    const tierId = log.args.tierId;
    const timestamp = log.args.timestamp;
    const amount = log.args.amount;
    if (!subscriber || tierId === undefined || timestamp === undefined || amount === undefined) {
      continue;
    }
    const ts = Number(timestamp);
    const existing = lastPayment.get(subscriber);
    if (!existing || ts > existing.timestamp) {
      lastPayment.set(subscriber, { tierId, timestamp: ts });
    }

    const logKey = `${log.transactionHash}:${log.logIndex}`;
    if (!processedLogKeys.has(logKey)) {
      processedLogKeys.add(logKey);
      paymentLog.push({
        address: subscriber,
        tierId,
        amount: amount.toString(),
        timestamp: ts,
        txHash: log.transactionHash,
      });
      if (paymentLog.length > PAYMENT_LOG_MAX_ENTRIES) {
        paymentLog.splice(0, paymentLog.length - PAYMENT_LOG_MAX_ENTRIES);
      }
    }
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
  tierId: number | null;
};

export async function getSubscriptionStatus(
  address: string
): Promise<SubscriptionStatus> {
  await syncOnce();

  const payment = lastPayment.get(address.toLowerCase()) ?? null;
  if (payment === null) {
    return { active: false, lastPaidAt: null, activeUntil: null, tierId: null };
  }

  const activeUntil = payment.timestamp + SUBSCRIPTION_PERIOD_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const active = nowSeconds < activeUntil;
  return {
    active,
    lastPaidAt: payment.timestamp,
    activeUntil,
    tierId: active ? payment.tierId : null,
  };
}

export type ChainSubscriptionSummary = {
  address: string;
  tierId: number;
  lastPaidAt: number;
  activeUntil: number;
  active: boolean;
};

/// Every address the indexer has ever seen a `SubscriptionPaid` event for —
/// used by the admin directory. Unlike `getSubscriptionStatus`, this always
/// reports the tier even when it's expired (`active: false`), since an
/// admin looking at a user wants to see "was on Premium, lapsed", not just
/// silence.
export async function listAllChainSubscriptions(): Promise<ChainSubscriptionSummary[]> {
  await syncOnce();
  const nowSeconds = Math.floor(Date.now() / 1000);
  return [...lastPayment.entries()].map(([address, payment]) => {
    const activeUntil = payment.timestamp + SUBSCRIPTION_PERIOD_SECONDS;
    return {
      address,
      tierId: payment.tierId,
      lastPaidAt: payment.timestamp,
      activeUntil,
      active: nowSeconds < activeUntil,
    };
  });
}

export async function listSubscriptionPaymentLog(
  limit = 100
): Promise<SubscriptionPaymentLogEntry[]> {
  await syncOnce();
  return paymentLog.slice(-limit).reverse();
}

export type SubscriptionIndexerHealth = {
  contractAddress: string;
  rpcUrl: string;
  lastSyncedBlock: string;
  rpcReachable: boolean;
};

/// For the admin diagnostics panel — surfaces the indexer's own config and
/// whether it can currently reach its RPC endpoint, instead of leaving a
/// misconfiguration to show up as silent-looking "no subscribers" data.
export async function getSubscriptionIndexerHealth(): Promise<SubscriptionIndexerHealth> {
  let rpcReachable = true;
  try {
    await client.getBlockNumber();
  } catch {
    rpcReachable = false;
  }
  return {
    contractAddress: CONTRACT_ADDRESS,
    rpcUrl: RPC_URL,
    lastSyncedBlock: lastSyncedBlock.toString(),
    rpcReachable,
  };
}
