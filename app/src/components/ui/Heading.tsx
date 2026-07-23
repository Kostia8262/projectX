// Closed set of heading styles — every view in the app should reach for one
// of these three instead of hand-rolling text-size/color combinations.
// See the design-system pass (2026) that introduced this: headings had
// drifted across text-xl/2xl/3xl with and without the gradient treatment,
// with no semantic reason for the differences.
import type { ReactNode } from "react";

// Page-level title: one per view (Магазин, Подписка, Кабинет tab, character
// hero name, ...). Gradient by default since that's the app's established
// "this is the top of a screen" signature; `plain` drops it for titles that
// sit over artwork/color where the gradient would fight the background.
export function PageTitle({
  children,
  className = "",
  as: Tag = "h1",
  plain = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  plain?: boolean;
}) {
  const style = plain
    ? "text-white drop-shadow-lg"
    : "bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-transparent";
  return (
    <Tag className={`text-2xl font-bold sm:text-3xl ${style} ${className}`}>{children}</Tag>
  );
}

// Section/card-level heading — a tier name, chapter title, admin table
// section ("Кошельки"). `dense` is for information-dense contexts (admin
// pages) where a full-size heading would eat too much vertical space.
export function SectionHeading({
  children,
  className = "",
  dense = false,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  const size = dense ? "text-sm" : "text-lg";
  return <h2 className={`${size} font-semibold text-white ${className}`}>{children}</h2>;
}

// Small uppercase label above a heading (tagline, category eyebrow).
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80 ${className}`}>
      {children}
    </p>
  );
}
