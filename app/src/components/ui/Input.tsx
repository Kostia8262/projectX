import type { InputHTMLAttributes } from "react";

// Shared by every form field across the admin pages — was previously typed
// out by hand (`rounded-lg border border-white/10 bg-black/20 px-3 py-1.5
// text-xs text-white outline-none`, sometimes rounded-lg, sometimes rounded-xl)
// on every single input/select/textarea. Exported as a plain class string
// (not just an <Input> component) so <select> and <textarea> — which need
// their own element, not this one — can still share the exact same look.
export const FORM_CONTROL_CLASS =
  "rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white outline-none focus:border-fuchsia-400/50";

export function Input({
  className = "",
  ...rest
}: { className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FORM_CONTROL_CLASS} ${className}`} {...rest} />;
}
