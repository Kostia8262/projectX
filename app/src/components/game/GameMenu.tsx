"use client";

import { useEffectiveGames } from "@/hooks/useGameOverrides";
import { PageTitle, SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function GameMenu({ onSelect }: { onSelect: (gameId: string) => void }) {
  const games = useEffectiveGames();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <PageTitle>Выберите испытание</PageTitle>
        <p className="mt-2 text-sm text-neutral-400">
          Каждая игра короткая, с узким набором действий — заходите на пару минут или залипайте
          надолго.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {games.map((game) => {
          const locked = game.status === "coming-soon";
          return (
            <Card key={game.id} className={`flex flex-col gap-3 ${locked ? "opacity-60" : ""}`}>
              <div>
                <Eyebrow>{game.tagline}</Eyebrow>
                <SectionHeading className="mt-1">{game.title}</SectionHeading>
              </div>
              <p className="flex-1 text-sm text-neutral-400">{game.description}</p>
              <Button
                onClick={() => !locked && onSelect(game.id)}
                disabled={locked}
                data-testid={`play-${game.id}`}
                className="w-full"
              >
                {locked ? "Скоро" : "Играть"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
