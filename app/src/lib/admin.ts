// Test/debug accounts get elevated privileges without touching the real
// economy constants (ENERGY_MAX etc. in games/energy.ts stay as the actual
// balance values to tune later). Currently just unlimited energy; extend
// here if more admin-only affordances are needed.
export const ADMIN_ENERGY = 999_999;

const ADMIN_ADDRESSES = [
  "0x31813373Dbda949eE637e71EA48CBE1199443243", // sosca17 dev wallet
  "0x936051bbD4e8eCEF26F7895Ec6Bd716278e0bB4d", // sosca17 browser dev wallet (devWalletConnector)
].map((a) => a.toLowerCase());

// This is the bootstrap allowlist — deliberately hardcoded in source rather
// than only living in the UI-managed list (see store.ts's `grantedAdmins`),
// so there's always at least one way into /admin/employees that doesn't
// depend on the employees feature itself already working. Exposed (already
// lowercased, no other data) so the Сотрудники page can list these
// alongside UI-granted admins and the API can refuse to let them be
// removed through the UI.
export const ADMIN_ADDRESSES_FOR_DISPLAY = ADMIN_ADDRESSES;

export function isAdminAddress(address: string): boolean {
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}
