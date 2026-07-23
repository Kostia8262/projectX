import type { ReactNode } from "react";

const VARIANTS = {
  neutral: "border border-white/10 bg-white/[0.06] text-neutral-300",
  highlight: "bg-fuchsia-500/20 text-fuchsia-300",
  success: "bg-emerald-500/20 text-emerald-300",
} as const;

// Shared by every plain informational pill (wallet address, sign-out
// control, energy counter) that isn't a fit for Badge below — those carry
// custom content/color (a font-mono address, a conditional low-energy red
// state) that doesn't fit Badge's fixed small-uppercase-tag role. Shape
// only, no color/background baked in, so callers stay free to vary those.
export const PILL_SHAPE_CLASS = "rounded-full border px-3 py-1 text-xs";

// Small uppercase status/category tag (Популярный, Без оплаты, Активна...).
// For a plain informational pill use `PILL_SHAPE_CLASS` directly instead —
// see the comment above.
export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span
      className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
