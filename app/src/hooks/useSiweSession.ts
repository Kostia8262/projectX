"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiweMessage } from "siwe";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  type Connector,
} from "wagmi";

export type SiweSession = {
  address: string;
  kind: "wallet" | "patreon";
  ageConfirmed: boolean;
  displayName?: string;
} | null;

async function fetchSession(): Promise<SiweSession> {
  const res = await fetch("/api/siwe/session");
  const data = await res.json();
  return data.session;
}

export function useSiweSession() {
  const queryClient = useQueryClient();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const sessionQuery = useQuery({
    queryKey: ["siwe-session"],
    queryFn: fetchSession,
  });

  const signIn = useMutation({
    mutationFn: async (connector: Connector) => {
      let account = address;
      let currentChainId = chainId;

      if (!isConnected || !account) {
        const result = await connectAsync({ connector });
        account = result.accounts[0];
        currentChainId = result.chainId;
      }

      if (!account || !currentChainId) {
        throw new Error("No wallet account available");
      }

      const nonceRes = await fetch("/api/siwe/nonce");
      const { nonce } = await nonceRes.json();

      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: account,
        // EIP-4361 requires the statement to be ASCII — keep this in English
        // even though the rest of the app's UI is in Russian.
        statement: "Sign in with your wallet.",
        uri: window.location.origin,
        version: "1",
        chainId: currentChainId,
        nonce,
      });
      const preparedMessage = siweMessage.prepareMessage();

      const signature = await signMessageAsync({ message: preparedMessage });

      const verifyRes = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: preparedMessage, signature }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error ?? "SIWE verification failed");
      }
      return verifyData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siwe-session"] });
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await fetch("/api/siwe/logout", { method: "POST" });
      // Patreon sessions never went through wagmi's connect() — nothing to
      // disconnect there, and calling it anyway is harmless but pointless.
      if (isConnected) await disconnectAsync();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siwe-session"] });
    },
  });

  const confirmAge = useMutation({
    mutationFn: async (message: string) => {
      const session = queryClient.getQueryData<SiweSession>(["siwe-session"]);
      // Patreon already proved identity via OAuth — no wallet to sign a
      // confirmation with, so the server accepts a plain confirmation there.
      const signature =
        session?.kind === "patreon" ? undefined : await signMessageAsync({ message });
      const res = await fetch("/api/age/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Age confirmation failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siwe-session"] });
    },
  });

  return { sessionQuery, signIn, signOut, confirmAge };
}
