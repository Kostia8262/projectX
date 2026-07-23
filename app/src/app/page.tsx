"use client";

import { useEffect, useState } from "react";
import { AgeGate } from "@/components/AgeGate";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EnergyBadge } from "@/components/EnergyBadge";
import { EnergyProvider } from "@/contexts/EnergyContext";
import { Cabinet } from "@/components/Cabinet";
import { SpankGame } from "@/components/game/SpankGame";
import { SpankGameRate } from "@/components/game/SpankGameRate";
import { CharacterSelect } from "@/components/character/CharacterSelect";
import { CharacterPage } from "@/components/character/CharacterPage";
import { CharacterHistoryPage } from "@/components/character/CharacterHistoryPage";
import { AccessoryShop } from "@/components/shop/AccessoryShop";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";
import { SubscriptionStatusBanner } from "@/components/SubscriptionStatusBanner";
import { useSiweSession } from "@/hooks/useSiweSession";
import { useEffectiveGame } from "@/hooks/useGameOverrides";
import { useChapter } from "@/hooks/useChapters";
import { useDisabledModules } from "@/hooks/useModules";
import { useQueryClient } from "@tanstack/react-query";
import type { ChapterRecord } from "@/lib/content/types";
import { getCharacter } from "@/lib/characters/registry";

type View =
  | { kind: "characters" }
  | { kind: "character"; characterId: string }
  | { kind: "history"; characterId: string }
  | { kind: "cabinet" }
  | { kind: "shop" }
  | { kind: "subscription" }
  | { kind: "game"; gameId: string; chapterId?: string; characterId?: string };

// There's no per-view URL — everything lives under "/" — so without this,
// a plain page refresh always dropped the player back to the character list
// regardless of where they were. Persisted per-tab (not permanently) so a
// refresh restores position but a fresh session still starts clean.
const VIEW_STORAGE_KEY = "kink-current-view";

function loadInitialView(): View {
  if (typeof window === "undefined") return { kind: "characters" };
  try {
    const raw = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as View;
  } catch {
    // fall through to default
  }
  return { kind: "characters" };
}

function AuthenticatedApp({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<View>(loadInitialView);
  const disabledModules = useDisabledModules();

  function setView(next: View) {
    setViewState(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(next));
    }
  }

  // Covers both a stale sessionStorage view restored on load and an admin
  // disabling the module while it's the currently open tab — either way,
  // bounce back to the main menu instead of leaving a switched-off page
  // rendered on screen.
  useEffect(() => {
    if (
      (view.kind === "shop" && disabledModules.has("shop")) ||
      (view.kind === "subscription" && disabledModules.has("subscription"))
    ) {
      setView({ kind: "characters" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind, disabledModules]);

  const activeGame = useEffectiveGame(view.kind === "game" ? view.gameId : undefined);
  const activeChapter = useChapter(view.kind === "game" ? view.chapterId : undefined);
  const activeCharacterPage =
    view.kind === "character" || view.kind === "history"
      ? getCharacter(view.characterId)
      : undefined;
  const inGame = view.kind === "game";

  function goBack() {
    if (view.kind === "game" && view.characterId) {
      setView({ kind: "character", characterId: view.characterId });
    } else if (view.kind === "history") {
      setView({ kind: "character", characterId: view.characterId });
    } else {
      setView({ kind: "characters" });
    }
  }

  const backLabel =
    view.kind === "game" && view.characterId
      ? `← ${getCharacter(view.characterId)?.name ?? "Назад"}`
      : view.kind === "history"
        ? `← ${getCharacter(view.characterId)?.name ?? "Назад"}`
        : "← Главная";

  function playChapter(chapterId: string) {
    // Not a hook call — reads whatever's already cached under the shared
    // ["chapters"] queryKey (see hooks/useChapters.ts). Safe here because
    // this only ever fires from a button that itself only rendered once
    // that same query had already resolved.
    const chapters = queryClient.getQueryData<ChapterRecord[]>(["chapters"]);
    const chapter = chapters?.find((c) => c.id === chapterId);
    if (chapter) {
      setView({ kind: "game", gameId: chapter.gameId, chapterId, characterId: chapter.characterId });
    }
  }

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
          <button
            onClick={() => setView({ kind: "characters" })}
            className={`text-sm transition hover:text-white ${view.kind === "characters" ? "text-white" : "text-neutral-400"}`}
          >
            Главная
          </button>
          {!disabledModules.has("shop") && (
            <button
              onClick={() => setView({ kind: "shop" })}
              className={`text-sm transition hover:text-white ${view.kind === "shop" ? "text-white" : "text-neutral-400"}`}
            >
              Магазин
            </button>
          )}
          {!disabledModules.has("subscription") && (
            <button
              onClick={() => setView({ kind: "subscription" })}
              className={`text-sm transition hover:text-white ${view.kind === "subscription" ? "text-white" : "text-neutral-400"}`}
            >
              Подписка
            </button>
          )}
          <button
            onClick={() => setView({ kind: "cabinet" })}
            className={`text-sm transition hover:text-white ${view.kind === "cabinet" ? "text-white" : "text-neutral-400"}`}
          >
            Кабинет
          </button>
          <ConnectWallet />
        </div>
      </header>
      <main
        className={
          inGame
            ? "flex flex-1 overflow-hidden"
            : // items-start (not items-center) on purpose: views with variable
              // height (Cabinet's tabs especially) would otherwise re-center
              // the whole block vertically on every height change, making the
              // nav/content visibly jump instead of just resizing in place.
              // scrollbar-gutter:stable for the same reason horizontally —
              // this is the scroll container for every top-level tab
              // (Персонажи/Магазин/Подписка/Кабинет), and without it the
              // centered content shifts left/right depending on whether the
              // tab you land on is tall enough to need a scrollbar.
              "flex flex-1 items-start justify-center overflow-y-auto py-10 [scrollbar-gutter:stable]"
        }
      >
        {view.kind === "characters" ? (
          <div className="flex w-full flex-col gap-8">
            <CharacterSelect
              address={address}
              onSelect={(characterId) => setView({ kind: "character", characterId })}
              onPlayChapter={playChapter}
              banner={
                disabledModules.has("subscription") ? undefined : (
                  <SubscriptionStatusBanner onGoToSubscription={() => setView({ kind: "subscription" })} />
                )
              }
            />
          </div>
        ) : view.kind === "character" && activeCharacterPage ? (
          <CharacterPage
            address={address}
            character={activeCharacterPage}
            onBack={() => setView({ kind: "characters" })}
            onPlayChapter={playChapter}
            onPlayGame={(gameId) =>
              setView({ kind: "game", gameId, characterId: activeCharacterPage.id })
            }
            onOpenHistory={() =>
              setView({ kind: "history", characterId: activeCharacterPage.id })
            }
          />
        ) : view.kind === "history" && activeCharacterPage ? (
          <CharacterHistoryPage
            character={activeCharacterPage}
            onBack={() => setView({ kind: "character", characterId: activeCharacterPage.id })}
          />
        ) : view.kind === "cabinet" ? (
          <Cabinet address={address} />
        ) : view.kind === "shop" ? (
          <AccessoryShop />
        ) : view.kind === "subscription" ? (
          <SubscriptionTiers />
        ) : view.kind === "game" && activeGame ? (
          activeGame.mechanic === "rate" ? (
            <SpankGameRate
              address={address}
              game={activeGame}
              titleOverride={activeChapter?.chapterTitle}
              storyOverride={activeChapter?.story}
              nextTeaser={activeChapter?.nextTeaser}
              decision={activeChapter?.decision}
              decisionIndex={activeChapter ? activeChapter.order - 2 : undefined}
              hints={activeChapter?.hints}
              introDialogue={activeChapter?.introDialogue}
              outroDialogue={activeChapter?.outroDialogue}
              onFinishChapter={
                view.characterId ? () => setView({ kind: "character", characterId: view.characterId! }) : undefined
              }
            />
          ) : (
            <SpankGame
              address={address}
              game={activeGame}
              titleOverride={activeChapter?.chapterTitle}
              storyOverride={activeChapter?.story}
              nextTeaser={activeChapter?.nextTeaser}
              decision={activeChapter?.decision}
              decisionIndex={activeChapter ? activeChapter.order - 2 : undefined}
              hints={activeChapter?.hints}
              introDialogue={activeChapter?.introDialogue}
              outroDialogue={activeChapter?.outroDialogue}
              onFinishChapter={
                view.characterId ? () => setView({ kind: "character", characterId: view.characterId! }) : undefined
              }
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
