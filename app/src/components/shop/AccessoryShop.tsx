"use client";

import { useState } from "react";
import { CHARACTERS } from "@/lib/characters/registry";
import { accessoriesFor } from "@/lib/shop/accessories";
import { buyAccessory, loadOwnedAccessories } from "@/lib/shop/ownership";

export function AccessoryShop({ address }: { address: string }) {
  const [owned, setOwned] = useState<string[]>(() => loadOwnedAccessories(address));

  function handleBuy(accessoryId: string) {
    buyAccessory(address, accessoryId);
    setOwned(loadOwnedAccessories(address));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Аксессуары
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Косметика для персонажей — наряды, декор и коллекционные предметы. Без игрового
          эффекта на механики, только внешний вид сцен.
        </p>
        <p className="mt-1 text-xs text-amber-400/80">
          Оплата — плейсхолдер: покупка сразу отмечается как совершённая, реальный платёж ещё
          не подключён.
        </p>
      </div>

      {CHARACTERS.map((character) => {
        const items = accessoriesFor(character.id);
        if (items.length === 0) return null;
        return (
          <div key={character.id}>
            <p className="mb-3 text-sm font-medium text-white">{character.name}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <span
                      className="h-12 w-full rounded-lg"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="flex-1 text-xs text-neutral-500">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-fuchsia-300">
                        {item.price} ₽
                      </span>
                      {isOwned ? (
                        <span className="text-xs font-medium text-emerald-400">Куплено</span>
                      ) : (
                        <button
                          onClick={() => handleBuy(item.id)}
                          data-testid={`buy-${item.id}`}
                          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Купить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
