import { network } from "hardhat";
import { parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const DEV_WALLET_PRIVATE_KEY =
  "0x3b5c37d5df13d70e840af98eb2ed73b5c6f4f611a56a551756a3165874f63bc7";

const { viem } = await network.create({ network: "localhost" });
const [funder] = await viem.getWalletClients();
const devAccount = privateKeyToAccount(DEV_WALLET_PRIVATE_KEY as `0x${string}`);
const publicClient = await viem.getPublicClient();
const devWalletClient = await viem.getWalletClient(devAccount.address, {
  account: devAccount,
});

// fund with local test ETH for gas
const fundHash = await funder.sendTransaction({
  to: devAccount.address,
  value: parseEther("1"),
});
await publicClient.waitForTransactionReceipt({ hash: fundHash });

const token = await viem.getContractAt(
  "MockStablecoin",
  "0x5FbDB2315678afecb367f032d93F642f64180aa3"
);
const subscription = await viem.getContractAt(
  "SubscriptionPayments",
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
);

const price = await subscription.read.subscriptionPrice();
await token.write.mint([devAccount.address, price * 5n]);
await token.write.approve([subscription.address, price * 5n], {
  account: devAccount,
});
const hash = await subscription.write.subscribe({ account: devAccount });
await publicClient.waitForTransactionReceipt({ hash });

console.log("Subscribed as dev wallet:", devAccount.address);
console.log("Tx:", hash);
