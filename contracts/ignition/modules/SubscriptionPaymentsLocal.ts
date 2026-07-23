import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

// Local/dev convenience module — also deploys a MockStablecoin and sets the
// three paid tiers to the same USDT prices shown in
// app/src/lib/subscription/tiers.ts (6/10/20), so the whole payment rail
// can be exercised on a local network with zero setup. Never use this
// module against a real network; use SubscriptionPayments.ts with a real
// paymentToken address instead.
export default buildModule("SubscriptionPaymentsLocalModule", (m) => {
  const deployer = m.getAccount(0);
  const treasury = m.getParameter<string>("treasury", m.getAccount(1) as unknown as string);
  const advancedPrice = m.getParameter<bigint>("advancedPrice", parseUnits("6", 6));
  const premiumPrice = m.getParameter<bigint>("premiumPrice", parseUnits("10", 6));
  const collectorPrice = m.getParameter<bigint>("collectorPrice", parseUnits("20", 6));

  const token = m.contract("MockStablecoin", [], {
    id: "MockStablecoin",
  });

  const subscription = m.contract("SubscriptionPayments", [token, treasury, deployer]);

  m.call(subscription, "setTierPrice", [1, advancedPrice], { id: "setAdvancedPrice" });
  m.call(subscription, "setTierPrice", [2, premiumPrice], { id: "setPremiumPrice" });
  m.call(subscription, "setTierPrice", [3, collectorPrice], { id: "setCollectorPrice" });

  return { token, subscription };
});
