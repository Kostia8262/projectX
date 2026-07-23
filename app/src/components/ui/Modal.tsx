"use client";

import type { ReactNode } from "react";
import { ELEVATED_SHADOW_CLASS } from "@/components/ui/Card";

// Generic centered modal — backdrop click and the corner button both close
// it; content is free-form so callers can mix a fixed header (image, etc.)
// with a scrolling body without the modal itself knowing about either.
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 ${ELEVATED_SHADOW_CLASS}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
