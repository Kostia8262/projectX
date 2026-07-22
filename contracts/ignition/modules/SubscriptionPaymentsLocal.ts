import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

// Local/dev convenience module — also deploys a MockStablecoin so the whole
// payment rail can be exercised on a local network with zero setup. Never
// use this module against a real network; use SubscriptionPayments.ts with
// a real paymentToken address instead.
export default buildModule("SubscriptionPaymentsLocalModule", (m) => {
  const deployer = m.getAccount(0);
  const treasury = m.getParameter<string>("treasury", m.getAccount(1) as unknown as string);
  const subscriptionPrice = m.getParameter<bigint>(
    "subscriptionPrice",
    parseUnits("10", 6)
  );

  const token = m.contract("MockStablecoin", [], {
    id: "MockStablecoin",
  });

  const subscription = m.contract("SubscriptionPayments", [
    token,
    treasury,
    subscriptionPrice,
    deployer,
  ]);

  return { token, subscription };
});
