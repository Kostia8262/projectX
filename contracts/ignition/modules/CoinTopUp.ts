import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Production-shaped module: paymentToken/treasury/finalOwner and each
// package's price must be supplied explicitly (via a parameters JSON
// file). Package ids must match app/src/lib/shop/coinConfig.ts. Same
// deployer-sets-config-then-hands-off-to-Safe pattern as
// SubscriptionPayments.ts — see that module's comment for why.
export default buildModule("CoinTopUpModule", (m) => {
  const paymentToken = m.getParameter<string>("paymentToken");
  const treasury = m.getParameter<string>("treasury");
  const finalOwner = m.getParameter<string>("finalOwner");
  const smallPackagePrice = m.getParameter<bigint>("smallPackagePrice");
  const mediumPackagePrice = m.getParameter<bigint>("mediumPackagePrice");
  const largePackagePrice = m.getParameter<bigint>("largePackagePrice");
  const deployer = m.getAccount(0);

  const coinTopUp = m.contract("CoinTopUp", [paymentToken, treasury, deployer]);

  const setSmall = m.call(coinTopUp, "setPackagePrice", [0, smallPackagePrice], {
    id: "setSmallPackagePrice",
  });
  const setMedium = m.call(coinTopUp, "setPackagePrice", [1, mediumPackagePrice], {
    id: "setMediumPackagePrice",
  });
  const setLarge = m.call(coinTopUp, "setPackagePrice", [2, largePackagePrice], {
    id: "setLargePackagePrice",
  });

  m.call(coinTopUp, "transferOwnership", [finalOwner], {
    id: "transferOwnershipToSafe",
    after: [setSmall, setMedium, setLarge],
  });

  return { coinTopUp };
});
