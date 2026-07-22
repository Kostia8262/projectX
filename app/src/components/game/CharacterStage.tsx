"use client";

// The character is a real shape reacting to input, not just a text label:
// its colour tracks the current heat stage, and it briefly pulses/brightens
// on every tap (via remounting on pulseKey, so the CSS animation restarts
// even if the colour didn't change). Swap the coloured div for real art
// later — everything downstream keys off `color`.
export function CharacterStage({
  color,
  label,
  caption,
  pulseKey,
}: {
  color: string;
  label: string;
  caption?: string;
  pulseKey: number;
}) {
  return (
    <div
      className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/30"
      data-testid="character-stage"
    >
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{ background: `radial-gradient(circle at 50% 55%, ${color}55, transparent 70%)` }}
      />
      <div
        key={pulseKey}
        data-testid="character-body"
        className="relative animate-character-pulse rounded-[42%] shadow-2xl transition-colors duration-500"
        style={{
          width: "min(48vh, 360px)",
          height: "min(48vh, 360px)",
          backgroundColor: color,
          boxShadow: `0 0 100px 10px ${color}66`,
        }}
      />
      <div className="absolute bottom-6 flex flex-col items-center gap-1 px-4 text-center">
        <span
          className="rounded-full border border-white/20 bg-black/50 px-4 py-1.5 text-sm font-semibold backdrop-blur"
          style={{ color }}
          data-testid="character-stage-label"
        >
          {label}
        </span>
        {caption && <span className="text-xs text-neutral-500">{caption}</span>}
      </div>
    </div>
  );
}
