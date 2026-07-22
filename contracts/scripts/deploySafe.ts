// Deploys the Gnosis Safe multisig that will serve as SubscriptionPayments'
// treasury. Run against a real network (Amoy, then mainnet) — Safe's factory
// and singleton contracts are only pre-deployed on real chains, not on a
// fresh local Hardhat node, so this intentionally isn't exercised locally.
//
// Usage: npx hardhat run scripts/deploySafe.ts --network polygonAmoy
import { network } from "hardhat";
import Safe from "@safe-global/protocol-kit";

// TODO before running for real: replace with the actual owner addresses —
// 2-3 keys held by different people/devices, per the plan. A single owner
// with threshold 1 defeats the point of a multisig; it's only acceptable as
// a temporary placeholder while wiring things up.
const OWNERS: string[] = [
  // "0x...owner1",
  // "0x...owner2",
];
const THRESHOLD = 1;

async function main() {
  if (OWNERS.length === 0) {
    throw new Error(
      "Set OWNERS in scripts/deploySafe.ts before deploying a real Safe."
    );
  }

  const { viem } = await network.create({ network: "polygonAmoy" });
  const [deployer] = await viem.getWalletClients();
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
  if (!rpcUrl) throw new Error("POLYGON_AMOY_RPC_URL is not set");

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: deployer.account.address,
    predictedSafe: {
      safeAccountConfig: {
        owners: OWNERS,
        threshold: THRESHOLD,
      },
    },
  });

  const predictedAddress = await protocolKit.getAddress();
  const alreadyDeployed = await protocolKit.isSafeDeployed();
  console.log("Predicted Safe address:", predictedAddress);
  console.log("Already deployed:", alreadyDeployed);

  if (alreadyDeployed) {
    console.log("Nothing to do — Safe is already live at this address.");
    return;
  }

  const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction();
  const publicClient = await viem.getPublicClient();

  const hash = await deployer.sendTransaction({
    to: deploymentTransaction.to as `0x${string}`,
    data: deploymentTransaction.data as `0x${string}`,
    value: BigInt(deploymentTransaction.value ?? 0),
  });
  console.log("Deployment transaction sent:", hash);

  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Safe deployed at:", predictedAddress);
  console.log(
    "Set this address as SubscriptionPayments' treasury (and, once confirmed, its owner)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
