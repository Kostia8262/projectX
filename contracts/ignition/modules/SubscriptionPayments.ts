import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Production-shaped module: paymentToken/treasury/finalOwner and each paid
// tier's price must be supplied explicitly (via a parameters JSON file) —
// no silent defaults for anything that touches real money or real
// ownership. Tier ids must match `app/src/lib/subscription/tierIds.ts`
// (1 = advanced, 2 = premium, 3 = collector; 0/free never touches this
// contract).
//
// Ownership handover is two steps on purpose: the contract is constructed
// with the DEPLOYER as owner so the deployer key can call the owner-gated
// `setTierPrice`, then ownership is transferred to `finalOwner` (the Gnosis
// Safe) last. Ownable2Step means that transfer is only "pending" until the
// Safe itself calls `acceptOwnership()` — not something this module can do,
// since that requires the Safe's own multisig approval flow.
export default buildModule("SubscriptionPaymentsModule", (m) => {
  const paymentToken = m.getParameter<string>("paymentToken");
  const treasury = m.getParameter<string>("treasury");
  const finalOwner = m.getParameter<string>("finalOwner");
  const advancedPrice = m.getParameter<bigint>("advancedPrice");
  const premiumPrice = m.getParameter<bigint>("premiumPrice");
  const collectorPrice = m.getParameter<bigint>("collectorPrice");
  const deployer = m.getAccount(0);

  const subscription = m.contract("SubscriptionPayments", [paymentToken, treasury, deployer]);

  const setAdvanced = m.call(subscription, "setTierPrice", [1, advancedPrice], {
    id: "setAdvancedPrice",
  });
  const setPremium = m.call(subscription, "setTierPrice", [2, premiumPrice], {
    id: "setPremiumPrice",
  });
  const setCollector = m.call(subscription, "setTierPrice", [3, collectorPrice], {
    id: "setCollectorPrice",
  });

  m.call(subscription, "transferOwnership", [finalOwner], {
    id: "transferOwnershipToSafe",
    after: [setAdvanced, setPremium, setCollector],
  });

  return { subscription };
});
