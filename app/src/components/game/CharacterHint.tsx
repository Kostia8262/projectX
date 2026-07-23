"use client";

import { useEffect, useRef, useState } from "react";
import type { ChapterHints } from "@/lib/content/types";

// How long a hint stays fully visible before starting to fade, and how long
// the fade-to-transparent transition itself takes (matches the duration-*
// class below — keep the two in sync if either changes).
const VISIBLE_MS = 2200;
const FADE_MS = 700;

// Drives one "she just said something" popup — a random line from whichever
// bucket of the chapter's `hints` (lib/content/types.ts) fired, shown for a
// couple seconds then faded to transparent, never fully removed from the DOM
// (so the fade transition can actually run instead of popping out instantly).
export function useCharacterHint(hints?: ChapterHints) {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const lastRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  function trigger(pool: string[]) {
    if (pool.length === 0) return;
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      while (pick === lastRef.current) pick = pool[Math.floor(Math.random() * pool.length)];
    }
    lastRef.current = pick;

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setText(pick);
    setVisible(true);
    hideTimerRef.current = setTimeout(() => setVisible(false), VISIBLE_MS);
  }

  // stageIndex matches games/registry.ts's HEAT_STAGES order (0 = "Спокойно"
  // ... 4 = "Предел") — see stage change handling in SpankGame/SpankGameRate.
  function triggerStage(stageIndex: number) {
    trigger(hints?.stage[stageIndex] ?? []);
  }

  function triggerBlocked() {
    trigger(hints?.blocked ?? []);
  }

  return { text, visible, triggerStage, triggerBlocked };
}

// Rendered inside a `relative` game container — absolutely positioned so it
// floats over the scene without shifting layout while it fades in and out.
export function CharacterHintToast({ text, visible }: { text: string | null; visible: boolean }) {
  if (!text) return null;
  return (
    <div
      aria-live="polite"
      data-testid="character-hint"
      className={`pointer-events-none absolute left-1/2 top-4 z-30 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-900/90 px-4 py-2.5 text-center text-sm leading-snug text-neutral-100 shadow-xl shadow-black/40 backdrop-blur transition-opacity ease-out ${
        visible ? "opacity-100 duration-200" : "opacity-0"
      }`}
      style={{ transitionDuration: visible ? undefined : `${FADE_MS}ms` }}
    >
      {text}
    </div>
  );
}
