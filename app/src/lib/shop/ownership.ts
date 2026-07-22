// Local ownership record — same honesty level as the existing "purchase"
// implement stub in Cabinet.tsx: marks an item as owned immediately, no
// real payment wired yet. A real purchase flow (on-chain or off) replaces
// just the `buyAccessory` call site, not this storage shape.
function ownershipKey(address: string): string {
  return `kink-accessories-owned-${address.toLowerCase()}`;
}

export function loadOwnedAccessories(address: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ownershipKey(address));
  return raw ? JSON.parse(raw) : [];
}

export function isAccessoryOwned(address: string, accessoryId: string): boolean {
  return loadOwnedAccessories(address).includes(accessoryId);
}

export function buyAccessory(address: string, accessoryId: string): void {
  const owned = loadOwnedAccessories(address);
  if (owned.includes(accessoryId)) return;
  owned.push(accessoryId);
  window.localStorage.setItem(ownershipKey(address), JSON.stringify(owned));
}
