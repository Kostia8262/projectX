import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Production-shaped module: paymentToken/treasury/initialOwner must be
// supplied explicitly (via a parameters JSON file) — no silent defaults for
// anything that touches real money or real ownership.
export default buildModule("SubscriptionPaymentsModule", (m) => {
  const paymentToken = m.getParameter<string>("paymentToken");
  const treasury = m.getParameter<string>("treasury");
  const subscriptionPrice = m.getParameter<bigint>("subscriptionPrice");
  const initialOwner = m.getParameter<string>("initialOwner");

  const subscription = m.contract("SubscriptionPayments", [
    paymentToken,
    treasury,
    subscriptionPrice,
    initialOwner,
  ]);

  return { subscription };
});
