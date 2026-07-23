import type { ReactNode } from "react";

const VARIANTS = {
  neutral: "border border-white/10 bg-white/[0.06] text-neutral-300",
  highlight: "bg-fuchsia-500/20 text-fuchsia-300",
  success: "bg-emerald-500/20 text-emerald-300",
} as const;

// Small uppercase status/category tag (Популярный, Без оплаты, Активна...).
// For a plain informational pill (wallet address, a removable chip) use the
// same `rounded-full border border-white/10 bg-white/[0.06] px-3 py-1
// text-xs` shape directly — those carry custom content (a font-mono
// address, an inline × button) that doesn't fit this component's tag role.
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
