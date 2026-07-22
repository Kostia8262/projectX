import { custom, fromHex, numberToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createConnector } from "wagmi";

const STORAGE_KEY = "dev-wallet-private-key";

/**
 * Phase 1 placeholder connector: a real EOA whose private key is generated
 * once and persisted in localStorage, so it can actually sign SIWE / age-gate
 * messages — unlike wagmi's built-in `mock` connector, which forwards
 * personal_sign to the chain RPC and can't really sign anything.
 *
 * Dev/testing only — never wire this into a production build.
 */
function getOrCreateDevAccount() {
  if (typeof window === "undefined") return null;
  let pk = window.localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    window.localStorage.setItem(STORAGE_KEY, pk);
  }
  return privateKeyToAccount(pk);
}

export function devWallet() {
  let connected = false;
  let connectedChainId: number;

  return createConnector((config) => ({
    id: "dev-wallet",
    name: "Тестовый кошелёк (без установки)",
    type: "devWallet",
    icon: undefined,

    async setup() {
      connectedChainId = config.chains[0].id;
    },

    async connect({ chainId }: { chainId?: number } = {}) {
      const account = getOrCreateDevAccount();
      if (!account) throw new Error("Dev wallet unavailable outside the browser");
      connected = true;
      connectedChainId = chainId ?? config.chains[0].id;
      config.emitter.emit("change", { chainId: connectedChainId });
      return { accounts: [account.address], chainId: connectedChainId };
    },

    async disconnect() {
      connected = false;
      config.emitter.emit("disconnect");
    },

    async getAccounts() {
      if (!connected) throw new Error("Not connected");
      const account = getOrCreateDevAccount();
      return account ? [account.address] : [];
    },

    async getChainId() {
      return connectedChainId ?? config.chains[0].id;
    },

    async isAuthorized() {
      return false; // always require an explicit click for this dev tool
    },

    async switchChain({ chainId }: { chainId: number }) {
      const chain = config.chains.find((c) => c.id === chainId);
      if (!chain) throw new Error("Chain not configured");
      connectedChainId = chainId;
      config.emitter.emit("change", { chainId });
      return chain;
    },

    onAccountsChanged() {},
    onChainChanged(chain: string) {
      config.emitter.emit("change", { chainId: Number(chain) });
    },
    async onDisconnect() {
      connected = false;
      config.emitter.emit("disconnect");
    },

    async getProvider() {
      const request = async ({
        method,
        params,
      }: {
        method: string;
        params?: unknown[];
      }) => {
        const account = getOrCreateDevAccount();

        if (method === "eth_chainId") {
          return numberToHex(connectedChainId ?? config.chains[0].id);
        }
        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          return account ? [account.address] : [];
        }
        if (method === "personal_sign") {
          if (!account) throw new Error("No dev account");
          const [messageHex] = params as [`0x${string}`, string];
          return account.signMessage({ message: { raw: messageHex } });
        }
        if (method === "wallet_switchEthereumChain") {
          const [{ chainId: hexChainId }] = params as [{ chainId: `0x${string}` }];
          connectedChainId = fromHex(hexChainId, "number");
          return null;
        }
        throw new Error(`Dev wallet: unsupported method ${method}`);
      };

      return custom({ request })({ retryCount: 0 });
    },
  }));
}
