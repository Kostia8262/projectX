import type { ReactNode, HTMLAttributes } from "react";

// `none` is for cards whose content manages its own padding per-section
// (e.g. a hero image bleeding to the edge with a padded footer below it) —
// still the same surface/radius, just no outer padding to fight with.
const PADDING = { none: "", sm: "p-4", md: "p-5", lg: "p-6" } as const;

// The two elevation steps every raised surface in the app should reach for
// instead of picking its own shadow-size/opacity combo (previously
// shadow-xl/30, shadow-2xl/40 and shadow-2xl/50 all meant "this is a card"
// depending who wrote the file). `card` is resting state; `elevated` is for
// anything that should read as floating above the rest of the page — age
// gate, tooltips, a hovered character card.
export const CARD_SHADOW_CLASS = "shadow-xl shadow-black/30";
export const ELEVATED_SHADOW_CLASS = "shadow-2xl shadow-black/40";
const SHADOW = { card: CARD_SHADOW_CLASS, elevated: ELEVATED_SHADOW_CLASS } as const;

// Primary container — every card-like block in the app (profile card, tier
// card, character detail panel, admin panels...) should be this, not a
// hand-rolled `rounded-2xl border border-white/10 bg-white/[0.06]...` copy.
// Radius is fixed at rounded-2xl; only padding varies by `size`.
export function Card({
  children,
  size = "md",
  shadow = "card",
  className = "",
  ...rest
}: {
  children: ReactNode;
  size?: keyof typeof PADDING;
  shadow?: keyof typeof SHADOW;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.06] ${SHADOW[shadow]} backdrop-blur-2xl ${PADDING[size]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

const TILE_PADDING = { sm: "p-3", md: "p-4" } as const;

// Nested/grid item inside a Card (accessory tile, achievement tile, implement
// tile, admin sub-panel) — one radius step down from Card, and a dimmer
// background since it usually sits ON a Card's already-lit surface.
export function Tile({
  children,
  size = "sm",
  className = "",
  ...rest
}: {
  children: ReactNode;
  size?: keyof typeof TILE_PADDING;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.03] ${TILE_PADDING[size]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
