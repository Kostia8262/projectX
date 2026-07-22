"use client";

import { GAMES } from "@/lib/games/registry";

export function GameMenu({ onSelect }: { onSelect: (gameId: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Выберите испытание
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Каждая игра короткая, с узким набором действий — заходите на пару минут или залипайте
          надолго.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((game) => {
          const locked = game.status === "coming-soon";
          return (
            <div
              key={game.id}
              className={`flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl ${
                locked ? "opacity-60" : ""
              }`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
                  {game.tagline}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">{game.title}</h2>
              </div>
              <p className="flex-1 text-sm text-neutral-400">{game.description}</p>
              <button
                onClick={() => !locked && onSelect(game.id)}
                disabled={locked}
                data-testid={`play-${game.id}`}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-neutral-700 disabled:to-neutral-700 disabled:opacity-60 disabled:hover:brightness-100"
              >
                {locked ? "Скоро" : "Играть"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
