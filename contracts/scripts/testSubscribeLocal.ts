import { network } from "hardhat";
import { parseUnits } from "viem";

const { viem } = await network.create({ network: "localhost" });
const [, subscriberClient] = await viem.getWalletClients();

const token = await viem.getContractAt(
  "MockStablecoin",
  "0x5FbDB2315678afecb367f032d93F642f64180aa3"
);
const subscription = await viem.getContractAt(
  "SubscriptionPayments",
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
);

const price = await subscription.read.subscriptionPrice();
await token.write.mint([subscriberClient.account.address, price * 5n]);
await token.write.approve([subscription.address, price * 5n], {
  account: subscriberClient.account,
});
const hash = await subscription.write.subscribe({ account: subscriberClient.account });

const publicClient = await viem.getPublicClient();
await publicClient.waitForTransactionReceipt({ hash });

console.log("Subscribed as:", subscriberClient.account.address);
console.log("Tx:", hash);
