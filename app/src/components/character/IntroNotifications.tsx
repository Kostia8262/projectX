"use client";

import { useState } from "react";
import type { CharacterDefinition } from "@/lib/characters/registry";

// Both girls' own lore has them messaging the player FIRST (see
// worldStory/history in characters/registry.ts) — this surfaces that as an
// actual notification on her card. Permanent: the bell always stays on the
// card so the message is always reachable, not a one-time toast that
// vanishes after the first read.
const INTRO_MESSAGE: Record<string, string> = {
  rin: "Простите, что пишу первой... я почти три недели не решалась. Можно, я просто — начну?",
  ada: "Не жду цветов и комплиментов. Посмотрим, хватит ли вас дольше, чем предыдущего.",
};

export function NotificationBell({
  character,
  className = "",
}: {
  character: CharacterDefinition;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen((o) => !o);
  }

  return (
    <div className={`absolute z-20 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Сообщение от ${character.name}`}
        data-testid={`intro-bell-${character.id}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-lg shadow-black/40 backdrop-blur transition hover:bg-black/70"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-bold text-white">
          1
        </span>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-white/10 bg-neutral-900/95 p-3 text-left shadow-2xl shadow-black/50 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color: character.accentColor }}>
              {character.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="Закрыть"
              className="text-neutral-500 transition hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-200">{INTRO_MESSAGE[character.id]}</p>
        </div>
      )}
    </div>
  );
}
