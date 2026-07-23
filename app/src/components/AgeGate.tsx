"use client";

import type { ReactNode } from "react";
import { useConnectors, type Connector } from "wagmi";
import { useSiweSession } from "@/hooks/useSiweSession";
import { AGE_DISCLAIMER_MESSAGE } from "@/lib/constants";
import { PageTitle } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function friendlyConnectError(message: string): string {
  if (message.includes("Provider not found")) {
    return "Кошелёк-расширение не найден в браузере. Установите MetaMask (или похожее расширение), либо используйте «Тестовый кошелёк» ниже.";
  }
  if (message.toLowerCase().includes("user rejected")) {
    return "Подключение отменено в кошельке.";
  }
  return message;
}

function GateCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card size="lg" className="w-full max-w-md text-center shadow-2xl shadow-black/40">
        {children}
      </Card>
    </div>
  );
}

function GateButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} size="lg" className="w-full">
      {children}
    </Button>
  );
}

// --- connector row list, styled after the reference wallet-picker layout,
// but only listing the connectors we actually support ---

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M16 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 14.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.2 11l7.6-3.5M8.2 13l7.6 3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PatreonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="15" cy="9.5" r="5.5" fill="currentColor" />
      <rect x="4" y="3" width="3" height="18" fill="currentColor" />
    </svg>
  );
}

type ConnectorMeta = { icon: ReactNode; subtitle: string; badge: string };

function metaFor(connector: Connector): ConnectorMeta {
  switch (connector.id) {
    case "dev-wallet":
      return {
        icon: <FlaskIcon />,
        subtitle: "Без установки — только для разработки",
        badge: "bg-amber-500/15 text-amber-300",
      };
    case "walletConnect":
      return {
        icon: <LinkIcon />,
        subtitle: "Мобильный кошелёк по QR-коду",
        badge: "bg-sky-500/15 text-sky-300",
      };
    default:
      return {
        icon: <WalletIcon />,
        subtitle: "Расширение браузера (MetaMask и похожие)",
        badge: "bg-orange-500/15 text-orange-300",
      };
  }
}

function ConnectorRow({
  connector,
  onClick,
  disabled,
}: {
  connector: Connector;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { icon, subtitle, badge } = metaFor(connector);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badge}`}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-white">{connector.name}</span>
        <span className="truncate text-xs text-neutral-400">{subtitle}</span>
      </span>
    </button>
  );
}

// Client id isn't secret (OAuth spec expects it public) — used only to
// decide whether to show the button at all; the actual exchange uses the
// server-only PATREON_CLIENT_SECRET in /api/patreon/*.
const patreonEnabled = Boolean(process.env.NEXT_PUBLIC_PATREON_CLIENT_ID);

export function AgeGate({ children }: { children: ReactNode }) {
  const { sessionQuery, signIn, confirmAge } = useSiweSession();
  const connectors = useConnectors();

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-400">
        Загрузка…
      </div>
    );
  }

  const session = sessionQuery.data;

  // Step 1: no wallet session yet — connect + SIWE sign-in
  if (!session) {
    return (
      <GateCard>
        <PageTitle>Войти через кошелёк</PageTitle>
        <p className="mt-3 text-sm text-neutral-400">
          Выберите способ подключения и подпишите сообщение для входа — без пароля и без
          базы данных для его хранения.
        </p>
        <div className="mt-6 flex flex-col gap-2 text-left">
          {connectors.map((connector) => (
            <ConnectorRow
              key={connector.uid}
              connector={connector}
              onClick={() => signIn.mutate(connector)}
              disabled={signIn.isPending}
            />
          ))}
          {patreonEnabled && (
            <a
              href="/api/patreon/authorize"
              data-testid="patreon-login"
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                <PatreonIcon />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-white">Patreon</span>
                <span className="truncate text-xs text-neutral-400">
                  Войти учётной записью Patreon вместо кошелька
                </span>
              </span>
            </a>
          )}
        </div>
        {signIn.isPending && (
          <p className="mt-4 text-sm text-neutral-400">Подключение…</p>
        )}
        {signIn.isError && (
          <p className="mt-4 text-sm text-red-400">
            {friendlyConnectError(signIn.error.message)}
          </p>
        )}
      </GateCard>
    );
  }

  // Step 2: session exists, but the signed age disclaimer is missing
  if (!session.ageConfirmed) {
    return (
      <GateCard>
        <PageTitle>Подтверждение возраста</PageTitle>
        <p className="mt-3 text-sm text-neutral-400">{AGE_DISCLAIMER_MESSAGE}</p>
        <div className="mt-6">
          <GateButton
            onClick={() => confirmAge.mutate(AGE_DISCLAIMER_MESSAGE)}
            disabled={confirmAge.isPending}
          >
            {confirmAge.isPending
              ? "Подтверждение…"
              : session.kind === "patreon"
                ? "Подтвердить, что мне 18+"
                : "Подписать и подтвердить, что мне 18+"}
          </GateButton>
        </div>
        {confirmAge.isError && (
          <p className="mt-4 text-sm text-red-400">{confirmAge.error.message}</p>
        )}
      </GateCard>
    );
  }

  // Both gates passed — render the real app
  return <>{children}</>;
}
