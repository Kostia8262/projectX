// Shared by every on-chain write flow that needs an ERC-20 approval first
// (coin top-up, subscription payment) — kept as a plain array rather than
// importing a full artifact, same approach as the event ABIs in the
// indexers.
export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
