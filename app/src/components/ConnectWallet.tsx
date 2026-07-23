"use client";

import { useSiweSession } from "@/hooks/useSiweSession";
import { PILL_SHAPE_CLASS } from "@/components/ui/Badge";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  const { sessionQuery, signOut } = useSiweSession();
  const session = sessionQuery.data;

  if (!session) return null;

  const label = session.kind === "patreon" ? (session.displayName ?? "Patreon") : shortenAddress(session.address);

  return (
    <div className="flex items-center gap-3 text-sm text-neutral-300">
      <span className={`${PILL_SHAPE_CLASS} border-white/10 bg-white/[0.06] font-mono backdrop-blur-xl`}>
        {label}
      </span>
      <button
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
        className={`${PILL_SHAPE_CLASS} border-white/10 bg-white/[0.06] text-neutral-300 backdrop-blur-xl transition hover:border-white/30 hover:text-white disabled:opacity-50`}
      >
        Выйти
      </button>
    </div>
  );
}
