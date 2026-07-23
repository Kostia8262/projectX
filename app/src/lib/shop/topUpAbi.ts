// Minimal ABI fragment — just what the top-up UI needs to call topUp() on
// CoinTopUp. Kept as a plain array rather than importing the full artifact
// from the separate `contracts/` package, same approach as coinIndexer.ts.
export const COIN_TOPUP_ABI = [
  {
    type: "function",
    name: "topUp",
    stateMutability: "nonpayable",
    inputs: [{ name: "packageId", type: "uint8" }],
    outputs: [],
  },
] as const;
