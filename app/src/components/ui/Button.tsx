import type { ButtonHTMLAttributes } from "react";

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
} as const;

// The app's one signature gradient (CTA buttons, affinity/progress bars,
// active toggles) — was independently retyped in three other files instead
// of reused. Anywhere that needs this exact fuchsia→indigo solid fill
// should import this instead of retyping the two color stops.
export const BRAND_GRADIENT_CLASS = "bg-gradient-to-r from-fuchsia-500 to-indigo-500";

const VARIANTS = {
  primary:
    `${BRAND_GRADIENT_CLASS} text-white shadow-lg shadow-fuchsia-900/30 hover:brightness-110 disabled:hover:brightness-100`,
  secondary:
    "border border-white/10 text-neutral-300 hover:border-white/30 hover:text-white",
  // Free/no-cost actions (the one CTA that isn't a purchase) — same emerald
  // signals "free"/"success" everywhere else in the app (Badge, status text).
  success:
    "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 disabled:hover:brightness-100",
} as const;

// Every CTA/action button in the app — collapses what used to be ~8 hand-
// picked size/padding/radius combinations (px-2 py-1 text-[11px] through
// px-6 py-3 text-sm, rounded-lg AND rounded-xl for the same role) into one
// closed set. Radius is always rounded-xl.
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl font-semibold transition disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
