import { ELEVATED_SHADOW_CLASS } from "@/components/ui/Card";

// Small "i" info icon that reveals a text tooltip on hover/focus — pure CSS
// (group-hover/group-focus-within), no JS state needed. Use next to a label
// wherever a control needs a one-line explanation without eating layout space.
export function InfoTooltip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="Подробнее"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-white/20 text-neutral-500 transition hover:border-white/40 hover:text-neutral-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 whitespace-pre-line rounded-lg border border-white/10 bg-neutral-900/95 p-2.5 text-xs leading-snug text-neutral-300 opacity-0 ${ELEVATED_SHADOW_CLASS} backdrop-blur transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
