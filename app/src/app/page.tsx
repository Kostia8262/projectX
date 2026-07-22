"use client";

import { useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EnergyBadge } from "@/components/EnergyBadge";
import { EnergyProvider } from "@/contexts/EnergyContext";
import { Cabinet } from "@/components/Cabinet";
import { Settings } from "@/components/Settings";
import { SpankGame } from "@/components/game/SpankGame";
import { SpankGameRate } from "@/components/game/SpankGameRate";
import { RewardsPanel } from "@/components/game/RewardsPanel";
import { CharacterSelect } from "@/components/character/CharacterSelect";
import { CharacterPage } from "@/components/character/CharacterPage";
import { AccessoryShop } from "@/components/shop/AccessoryShop";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";
import { useSiweSession } from "@/hooks/useSiweSession";
import { getGame } from "@/lib/games/registry";
import { getChapter } from "@/lib/games/chapters";
import { getCharacter } from "@/lib/characters/registry";

type View =
  | { kind: "characters" }
  | { kind: "character"; characterId: string }
  | { kind: "cabinet" }
  | { kind: "settings" }
  | { kind: "shop" }
  | { kind: "subscription" }
  | { kind: "game"; gameId: string; chapterId?: string; characterId?: string };

function AuthenticatedApp({ address }: { address: string }) {
  const [view, setView] = useState<View>({ kind: "characters" });

  const activeGame = view.kind === "game" ? getGame(view.gameId) : undefined;
  const activeChapter =
    view.kind === "game" && view.chapterId ? getChapter(view.chapterId) : undefined;
  const activeCharacterPage = view.kind === "character" ? getCharacter(view.characterId) : undefined;
  const inGame = view.kind === "game";

  function goBack() {
    if (view.kind === "game" && view.characterId) {
      setView({ kind: "character", characterId: view.characterId });
    } else {
      setView({ kind: "characters" });
    }
  }

  const backLabel =
    view.kind === "game" && view.characterId
      ? `← ${getCharacter(view.characterId)?.name ?? "Назад"}`
      : "← Персонажи";

  return (
    <div className="flex min-h-screen flex-col text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {view.kind !== "characters" && (
            <button onClick={goBack} className="text-sm text-neutral-400 transition hover:text-white">
              {backLabel}
            </button>
          )}
          <span className="bg-gradient-to-r from-fuchsia-300 to-indigo-300 bg-clip-text text-sm font-semibold tracking-wide text-transparent">
            KINK · placeholder
          </span>
        </div>
        <div className="flex items-center gap-3">
          <EnergyBadge />
          {view.kind === "characters" && (
            <>
              <button
                onClick={() => setView({ kind: "shop" })}
                className="text-sm text-neutral-400 transition hover:text-white"
              >
                Магазин
              </button>
              <button
                onClick={() => setView({ kind: "subscription" })}
                className="text-sm text-neutral-400 transition hover:text-white"
              >
                Подписка
              </button>
              <button
                onClick={() => setView({ kind: "cabinet" })}
                className="text-sm text-neutral-400 transition hover:text-white"
              >
                Кабинет
              </button>
              <button
                onClick={() => setView({ kind: "settings" })}
                className="text-sm text-neutral-400 transition hover:text-white"
              >
                Настройки
              </button>
            </>
          )}
          <ConnectWallet />
        </div>
      </header>
      <main
        className={
          inGame ? "flex flex-1 overflow-hidden" : "flex flex-1 items-center justify-center py-10"
        }
      >
        {view.kind === "characters" ? (
          <div className="flex w-full flex-col gap-8">
            <RewardsPanel address={address} />
            <CharacterSelect
              address={address}
              onSelect={(characterId) => setView({ kind: "character", characterId })}
            />
          </div>
        ) : view.kind === "character" && activeCharacterPage ? (
          <CharacterPage
            address={address}
            character={activeCharacterPage}
            onBack={() => setView({ kind: "characters" })}
            onPlayChapter={(chapterId) => {
              const chapter = getChapter(chapterId);
              if (chapter) {
                setView({
                  kind: "game",
                  gameId: chapter.gameId,
                  chapterId,
                  characterId: activeCharacterPage.id,
                });
              }
            }}
            onPlayGame={(gameId) =>
              setView({ kind: "game", gameId, characterId: activeCharacterPage.id })
            }
          />
        ) : view.kind === "cabinet" ? (
          <Cabinet address={address} />
        ) : view.kind === "settings" ? (
          <Settings address={address} />
        ) : view.kind === "shop" ? (
          <AccessoryShop address={address} />
        ) : view.kind === "subscription" ? (
          <SubscriptionTiers />
        ) : view.kind === "game" && activeGame ? (
          activeGame.mechanic === "rate" ? (
            <SpankGameRate
              address={address}
              game={activeGame}
              titleOverride={activeChapter?.chapterTitle}
              storyOverride={activeChapter?.story}
            />
          ) : (
            <SpankGame
              address={address}
              game={activeGame}
              titleOverride={activeChapter?.chapterTitle}
              storyOverride={activeChapter?.story}
            />
          )
        ) : null}
      </main>
    </div>
  );
}

function Gate() {
  const { sessionQuery } = useSiweSession();
  const address = sessionQuery.data?.address;

  if (!address) return <p className="text-neutral-500">Загрузка…</p>;

  return (
    <EnergyProvider address={address}>
      <AuthenticatedApp address={address} />
    </EnergyProvider>
  );
}

export default function Home() {
  return (
    <AgeGate>
      <Gate />
    </AgeGate>
  );
}
