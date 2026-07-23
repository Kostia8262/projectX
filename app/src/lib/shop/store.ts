import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GameOverride } from "../games/registry";
import type { EmployeeRole } from "../admin/roles";
import type { ModuleId } from "../modules";

// Server-side source of truth for shop state — coin balances, which
// on-chain top-up transactions have already been credited (idempotency
// guard for the indexer), and which accessories each address owns. Replaces
// the old client-side `localStorage` version (see git history of
// `shop/ownership.ts`), which any player could forge for free in devtools.
//
// Persistence is a single JSON file, not a real database — this project has
// no database anywhere yet (even subscription status is an in-memory
// indexer over chain events, lost on restart). A file is the smallest step
// that actually survives a restart; move to Postgres/Supabase only once
// there's traction to justify it, same reasoning as the rest of the
// Simplified MVP architecture.
type SubscriptionOverride = { tierId: number; activeUntil: number };
type AdminLogEntry = {
  at: number;
  admin: string;
  action: string;
  address: string;
  detail: string;
};

type CoinTopUpLogEntry = {
  address: string;
  coins: number;
  at: number; // ms epoch when the indexer credited it (not the on-chain block timestamp)
  ledgerKey: string; // `${txHash}:${logIndex}`
};

// `role` is optional on the stored shape because entries persisted before
// roles existed won't have it — everywhere that reads a GrantedAdmin falls
// back to "support" (see roleOf below), never silently upgrading a legacy
// entry to "owner".
type GrantedAdmin = { addedBy: string; addedAt: number; label: string; role?: EmployeeRole };

function roleOf(g: GrantedAdmin): EmployeeRole {
  return g.role ?? "support";
}

type ShopState = {
  balances: Record<string, number>; // lowercased address -> coin balance
  processedTopUps: Record<string, true>; // `${txHash}:${logIndex}` -> already credited
  owned: Record<string, string[]>; // lowercased address -> accessoryId[]
  freePlanActivated: Record<string, true>;
  // Admin-granted subscription access, for testing/support when a wallet
  // can't go through the real on-chain flow (e.g. testnet funding blocked).
  // Only consulted when the chain-derived status is inactive — see
  // lib/subscription/effectiveStatus.ts.
  subscriptionOverrides: Record<string, SubscriptionOverride>;
  adminLog: AdminLogEntry[];
  // Real payment history (as opposed to `balances`, which is just current
  // state) — for the admin transaction log. Capped the same way as adminLog.
  coinTopUpLog: CoinTopUpLogEntry[];
  // Admins granted through the UI (Сотрудники page), on top of the
  // hardcoded seed list in lib/admin.ts. Kept separate from that file
  // deliberately: the seed list is the bootstrap allowlist that can never
  // be edited away by a UI bug or a bad click (see requireAdminSession),
  // this one can grow/shrink freely.
  grantedAdmins: Record<string, GrantedAdmin>;
  // Admin edits to GAMES (games/registry.ts) — gameId -> patch. The code
  // array stays the base/default; an entry here overrides specific fields
  // on top of it. See games/registry.ts's applyGameOverrides and
  // api/games/overrides (public read) / api/admin/games (admin write).
  gameOverrides: Record<string, GameOverride>;
  // Whole pages (see lib/modules.ts) an admin has switched off — moduleId ->
  // true. Absence = enabled, same "only store the exception" shape as the
  // rest of this file.
  disabledModules: Record<string, true>;
};

function emptyState(): ShopState {
  return {
    balances: {},
    processedTopUps: {},
    owned: {},
    freePlanActivated: {},
    subscriptionOverrides: {},
    adminLog: [],
    coinTopUpLog: [],
    grantedAdmins: {},
    gameOverrides: {},
    disabledModules: {},
  };
}

const TRANSACTION_LOG_MAX_ENTRIES = 500;

const ADMIN_LOG_MAX_ENTRIES = 200;

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "shop-store.json");

let cached: ShopState | null = null;

async function load(): Promise<ShopState> {
  if (cached) return cached;
  let state: ShopState;
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    state = { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    state = emptyState();
  }
  cached = state;
  return cached;
}

async function persist(state: ShopState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// All reads/writes go through this queue so concurrent requests in the same
// process serialize instead of racing on a read-modify-write over the file.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}

function key(address: string): string {
  return address.toLowerCase();
}

export async function getBalance(address: string): Promise<number> {
  return enqueue(async () => {
    const state = await load();
    return state.balances[key(address)] ?? 0;
  });
}

export async function getOwnedAccessories(address: string): Promise<string[]> {
  return enqueue(async () => {
    const state = await load();
    return state.owned[key(address)] ?? [];
  });
}

export async function isFreePlanActivatedFor(address: string): Promise<boolean> {
  return enqueue(async () => {
    const state = await load();
    return Boolean(state.freePlanActivated[key(address)]);
  });
}

/// Credits `amount` coins to `address` for a given on-chain top-up
/// transaction, unless that exact log has already been credited. Returns
/// whether this call actually credited anything (false = already processed).
export async function creditTopUp(
  address: string,
  amount: number,
  ledgerKey: string
): Promise<boolean> {
  return enqueue(async () => {
    const state = await load();
    if (state.processedTopUps[ledgerKey]) return false;
    const k = key(address);
    state.balances[k] = (state.balances[k] ?? 0) + amount;
    state.processedTopUps[ledgerKey] = true;
    state.coinTopUpLog.push({ address: k, coins: amount, at: Date.now(), ledgerKey });
    if (state.coinTopUpLog.length > TRANSACTION_LOG_MAX_ENTRIES) {
      state.coinTopUpLog.splice(0, state.coinTopUpLog.length - TRANSACTION_LOG_MAX_ENTRIES);
    }
    await persist(state);
    return true;
  });
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; reason: "already-owned" | "insufficient-balance" };

/// Atomically debits `price` coins and grants `accessoryId`, or fails
/// without side effects if the item is already owned or the balance is too
/// low. `price === 0` (registration gifts, free grants) never touches the
/// balance.
export async function purchaseAccessory(
  address: string,
  accessoryId: string,
  price: number
): Promise<PurchaseResult> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const owned = state.owned[k] ?? [];
    if (owned.includes(accessoryId)) return { ok: false, reason: "already-owned" };

    const balance = state.balances[k] ?? 0;
    if (price > 0 && balance < price) return { ok: false, reason: "insufficient-balance" };

    state.owned[k] = [...owned, accessoryId];
    if (price > 0) state.balances[k] = balance - price;
    await persist(state);
    return { ok: true };
  });
}

export type SpendResult = { ok: true; balance: number } | { ok: false; reason: "insufficient-balance" };

/// Generic coin debit for anything that isn't an accessory purchase — the
/// energy-refill shortcut, Карт-бланш/Забота (see characters/override.ts) —
/// same atomicity guarantee as purchaseAccessory, just without the
/// ownership side effect.
export async function spendCoins(address: string, amount: number): Promise<SpendResult> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const balance = state.balances[k] ?? 0;
    if (amount > 0 && balance < amount) return { ok: false, reason: "insufficient-balance" };

    const nextBalance = amount > 0 ? balance - amount : balance;
    if (amount > 0) state.balances[k] = nextBalance;
    await persist(state);
    return { ok: true, balance: nextBalance };
  });
}

export async function activateFreePlanFor(
  address: string,
  registrationGiftIds: string[]
): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    state.freePlanActivated[k] = true;
    const owned = new Set(state.owned[k] ?? []);
    for (const id of registrationGiftIds) owned.add(id);
    state.owned[k] = [...owned];
    await persist(state);
  });
}

function pushAdminLog(state: ShopState, entry: AdminLogEntry): void {
  state.adminLog.push(entry);
  if (state.adminLog.length > ADMIN_LOG_MAX_ENTRIES) {
    state.adminLog.splice(0, state.adminLog.length - ADMIN_LOG_MAX_ENTRIES);
  }
}

// ---- Admin-only operations below. Callers MUST have already verified the
// caller is an admin (see lib/admin/session.ts) — this module has no
// authorization logic of its own, same as every other function here.

export async function getSubscriptionOverride(
  address: string
): Promise<SubscriptionOverride | null> {
  return enqueue(async () => {
    const state = await load();
    return state.subscriptionOverrides[key(address)] ?? null;
  });
}

export async function setSubscriptionOverride(
  adminAddress: string,
  address: string,
  tierId: number,
  activeUntil: number
): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    state.subscriptionOverrides[k] = { tierId, activeUntil };
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "grant-subscription",
      address: k,
      detail: `tierId=${tierId} until=${new Date(activeUntil * 1000).toISOString()}`,
    });
    await persist(state);
  });
}

export async function clearSubscriptionOverride(
  adminAddress: string,
  address: string
): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    delete state.subscriptionOverrides[k];
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "clear-subscription-override",
      address: k,
      detail: "",
    });
    await persist(state);
  });
}

export async function adminCreditCoins(
  adminAddress: string,
  address: string,
  amount: number
): Promise<number> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    state.balances[k] = (state.balances[k] ?? 0) + amount;
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "grant-coins",
      address: k,
      detail: `amount=${amount}`,
    });
    await persist(state);
    return state.balances[k];
  });
}

export async function adminGrantAccessory(
  adminAddress: string,
  address: string,
  accessoryId: string
): Promise<{ granted: boolean }> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const owned = state.owned[k] ?? [];
    if (owned.includes(accessoryId)) return { granted: false };
    state.owned[k] = [...owned, accessoryId];
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "grant-accessory",
      address: k,
      detail: accessoryId,
    });
    await persist(state);
    return { granted: true };
  });
}

export async function adminDeductCoins(
  adminAddress: string,
  address: string,
  amount: number
): Promise<number> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const before = state.balances[k] ?? 0;
    state.balances[k] = Math.max(0, before - amount);
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "deduct-coins",
      address: k,
      detail: `amount=${amount}${amount > before ? ` (clamped, had ${before})` : ""}`,
    });
    await persist(state);
    return state.balances[k];
  });
}

// Not address-scoped like the rest of adminLog's entries — `address` here
// holds the gameId instead, since a game override has no wallet involved.
export async function getGameOverrides(): Promise<Record<string, GameOverride>> {
  return enqueue(async () => {
    const state = await load();
    return { ...state.gameOverrides };
  });
}

export async function setGameOverride(
  adminAddress: string,
  gameId: string,
  patch: GameOverride
): Promise<GameOverride> {
  return enqueue(async () => {
    const state = await load();
    const next = { ...(state.gameOverrides[gameId] ?? {}), ...patch };
    state.gameOverrides[gameId] = next;
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "set-game-override",
      address: gameId,
      detail: JSON.stringify(patch),
    });
    await persist(state);
    return next;
  });
}

export async function clearGameOverride(adminAddress: string, gameId: string): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    delete state.gameOverrides[gameId];
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "clear-game-override",
      address: gameId,
      detail: "",
    });
    await persist(state);
  });
}

export async function adminRevokeAccessory(
  adminAddress: string,
  address: string,
  accessoryId: string
): Promise<{ revoked: boolean }> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const owned = state.owned[k] ?? [];
    if (!owned.includes(accessoryId)) return { revoked: false };
    state.owned[k] = owned.filter((id) => id !== accessoryId);
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: "revoke-accessory",
      address: k,
      detail: accessoryId,
    });
    await persist(state);
    return { revoked: true };
  });
}

export type AdminUserSummary = {
  address: string;
  balance: number;
  ownedIds: string[];
  freePlanActivated: boolean;
};

/// Every address this store has ever recorded anything for — the closest
/// thing to a user directory this file-backed store can offer without a
/// real database.
export async function listKnownAddresses(): Promise<AdminUserSummary[]> {
  return enqueue(async () => {
    const state = await load();
    const addresses = new Set([
      ...Object.keys(state.balances),
      ...Object.keys(state.owned),
      ...Object.keys(state.freePlanActivated),
    ]);
    return [...addresses].map((address) => ({
      address,
      balance: state.balances[address] ?? 0,
      ownedIds: state.owned[address] ?? [],
      freePlanActivated: Boolean(state.freePlanActivated[address]),
    }));
  });
}

export async function getAdminLog(limit = 50): Promise<AdminLogEntry[]> {
  return enqueue(async () => {
    const state = await load();
    return state.adminLog.slice(-limit).reverse();
  });
}

export async function listSubscriptionOverrides(): Promise<
  Record<string, SubscriptionOverride>
> {
  return enqueue(async () => {
    const state = await load();
    return { ...state.subscriptionOverrides };
  });
}

export async function listCoinTopUpLog(limit = 100): Promise<CoinTopUpLogEntry[]> {
  return enqueue(async () => {
    const state = await load();
    return state.coinTopUpLog.slice(-limit).reverse();
  });
}

// Returns the employee's role if they were granted admin through the UI,
// null otherwise. Doesn't know about the seed list in lib/admin.ts — that's
// resolved separately in requireAdminSession, which always treats seed
// addresses as "owner" regardless of what's in this store.
export async function getGrantedAdminRole(address: string): Promise<EmployeeRole | null> {
  return enqueue(async () => {
    const state = await load();
    const g = state.grantedAdmins[key(address)];
    return g ? roleOf(g) : null;
  });
}

export type GrantedAdminEntry = {
  address: string;
  addedBy: string;
  addedAt: number;
  label: string;
  role: EmployeeRole;
};

export async function listGrantedAdmins(): Promise<GrantedAdminEntry[]> {
  return enqueue(async () => {
    const state = await load();
    return Object.entries(state.grantedAdmins).map(([address, g]) => ({
      address,
      ...g,
      role: roleOf(g),
    }));
  });
}

export async function addGrantedAdmin(
  actingAdmin: string,
  address: string,
  label: string,
  role: EmployeeRole
): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    state.grantedAdmins[k] = { addedBy: key(actingAdmin), addedAt: Date.now(), label, role };
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(actingAdmin),
      action: "add-employee",
      address: k,
      detail: `${label} (${role})`,
    });
    await persist(state);
  });
}

// Changes an existing employee's role. Only meaningful for UI-granted
// employees — seed admins (lib/admin.ts) aren't in this store at all and
// are always "owner", so there's nothing here to change for them.
export async function setGrantedAdminRole(
  actingAdmin: string,
  address: string,
  role: EmployeeRole
): Promise<boolean> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    const existing = state.grantedAdmins[k];
    if (!existing) return false;
    existing.role = role;
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(actingAdmin),
      action: "change-employee-role",
      address: k,
      detail: role,
    });
    await persist(state);
    return true;
  });
}

export async function getDisabledModules(): Promise<ModuleId[]> {
  return enqueue(async () => {
    const state = await load();
    return Object.keys(state.disabledModules) as ModuleId[];
  });
}

export async function setModuleEnabled(
  adminAddress: string,
  moduleId: ModuleId,
  enabled: boolean
): Promise<void> {
  return enqueue(async () => {
    const state = await load();
    if (enabled) {
      delete state.disabledModules[moduleId];
    } else {
      state.disabledModules[moduleId] = true;
    }
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(adminAddress),
      action: enabled ? "enable-module" : "disable-module",
      address: moduleId,
      detail: "",
    });
    await persist(state);
  });
}

export async function removeGrantedAdmin(actingAdmin: string, address: string): Promise<boolean> {
  return enqueue(async () => {
    const state = await load();
    const k = key(address);
    if (!state.grantedAdmins[k]) return false;
    delete state.grantedAdmins[k];
    pushAdminLog(state, {
      at: Date.now(),
      admin: key(actingAdmin),
      action: "remove-employee",
      address: k,
      detail: "",
    });
    await persist(state);
    return true;
  });
}
