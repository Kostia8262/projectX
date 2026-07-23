// Minimal ABI fragment — just what the subscription UI needs to call
// subscribe() on SubscriptionPayments. Kept as a plain array rather than
// importing the full artifact from the separate `contracts/` package, same
// approach as subscriptionIndexer.ts.
export const SUBSCRIBE_ABI = [
  {
    type: "function",
    name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [{ name: "tierId", type: "uint8" }],
    outputs: [],
  },
] as const;
