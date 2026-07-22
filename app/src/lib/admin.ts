// Test/debug accounts get elevated privileges without touching the real
// economy constants (ENERGY_MAX etc. in games/energy.ts stay as the actual
// balance values to tune later). Currently just unlimited energy; extend
// here if more admin-only affordances are needed.
export const ADMIN_ENERGY = 999_999;

const ADMIN_ADDRESSES = [
  "0x31813373Dbda949eE637e71EA48CBE1199443243", // sosca17 dev wallet
].map((a) => a.toLowerCase());

export function isAdminAddress(address: string): boolean {
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}
