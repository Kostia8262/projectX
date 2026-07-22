// Placeholder "crypto site" backdrop — generic gradient glow + grain, not
// brand-specific. Meant to be replaced by the real hand-crafted design
// system in Phase 6–9.
export function GradientBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-neutral-950">
      <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-fuchsia-600/30 blur-[120px]" />
      <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/30 blur-[120px]" />
      <div className="absolute -bottom-48 left-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-700/25 blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
