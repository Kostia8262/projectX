import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { devWallet } from "@/lib/devWalletConnector";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Phase 1 has three connector options so testing doesn't require buying/
// installing anything:
// - injected(): real MetaMask/browser-extension wallet, if one is installed
// - devWallet(): a real signing key generated + kept in localStorage, so the
//   whole SIWE/age-gate flow can be clicked through with zero setup — dev/
//   testing only, never for production
// - walletConnect(): a real mobile wallet via QR code — only added if a free
//   project ID (from cloud.reown.com) is set in .env.local, otherwise omitted
export const wagmiConfig = createConfig({
  chains: [polygonAmoy, polygon],
  connectors: [
    injected(),
    devWallet(),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId })]
      : []),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [polygonAmoy.id]: http(),
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
