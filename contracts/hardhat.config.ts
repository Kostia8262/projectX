import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // A long-running local node (`npx hardhat node`) instead of the ephemeral
    // in-process network — lets the indexer/backend connect over RPC and see
    // state persist between commands, standing in for the testnet until it's
    // funded.
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    // Free public testnet — no real funds involved. Needs test MATIC from a
    // faucet and a throwaway private key set as a config variable, not used
    // until we actually run a testnet deployment.
    polygonAmoy: {
      type: "http",
      chainType: "l1",
      url: configVariable("POLYGON_AMOY_RPC_URL"),
      accounts: [configVariable("POLYGON_AMOY_PRIVATE_KEY")],
    },
  },
});
