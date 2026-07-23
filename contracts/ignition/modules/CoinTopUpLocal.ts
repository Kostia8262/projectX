import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

// Local/dev convenience module — also deploys a MockStablecoin and sets the
// three packages to the same prices as app/src/lib/shop/coinConfig.ts
// (3 / 7.5 / 15 USDT), so the whole top-up rail can be exercised on a local
// network with zero setup. Never use this module against a real network;
// use CoinTopUp.ts with a real paymentToken address instead.
export default buildModule("CoinTopUpLocalModule", (m) => {
  const deployer = m.getAccount(0);
  const treasury = m.getParameter<string>("treasury", m.getAccount(1) as unknown as string);
  const smallPackagePrice = m.getParameter<bigint>("smallPackagePrice", parseUnits("3", 6));
  const mediumPackagePrice = m.getParameter<bigint>("mediumPackagePrice", parseUnits("7.5", 6));
  const largePackagePrice = m.getParameter<bigint>("largePackagePrice", parseUnits("15", 6));

  const token = m.contract("MockStablecoin", [], {
    id: "MockStablecoin",
  });

  const coinTopUp = m.contract("CoinTopUp", [token, treasury, deployer]);

  m.call(coinTopUp, "setPackagePrice", [0, smallPackagePrice], { id: "setSmallPackagePrice" });
  m.call(coinTopUp, "setPackagePrice", [1, mediumPackagePrice], { id: "setMediumPackagePrice" });
  m.call(coinTopUp, "setPackagePrice", [2, largePackagePrice], { id: "setLargePackagePrice" });

  return { token, coinTopUp };
});
