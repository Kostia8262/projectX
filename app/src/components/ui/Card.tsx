import type { ReactNode, HTMLAttributes } from "react";

const PADDING = { sm: "p-4", md: "p-5", lg: "p-6" } as const;

// Primary container — every card-like block in the app (profile card, tier
// card, character detail panel, admin panels...) should be this, not a
// hand-rolled `rounded-2xl border border-white/10 bg-white/[0.06]...` copy.
// Radius is fixed at rounded-2xl; only padding varies by `size`.
export function Card({
  children,
  size = "md",
  className = "",
  ...rest
}: {
  children: ReactNode;
  size?: keyof typeof PADDING;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/30 backdrop-blur-2xl ${PADDING[size]} ${className}`}
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
