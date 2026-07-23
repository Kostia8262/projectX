"use client";

import type { CharacterDefinition } from "@/lib/characters/registry";
import {
  AFTERCARE_PRICE,
  CARTE_BLANCHE_PRICE,
  CARTE_BLANCHE_ROUNDS,
  buyAftercare,
  buyCarteBlanche,
  isOverrideActive,
  isRecovering,
  type OverrideState,
} from "@/lib/characters/override";

// Two small icons, not a shop listing — bought on impulse mid-scene, not
// browsed. ∞ unlocks a few rounds with every gate lifted (see
// isImplementBlocked's `overriding` param); ♥ only appears once there's
// actually an aftercare debuff to relieve (see applyAftercareDebuff).
export function OverrideControls({
  address,
  character,
  state,
  onChange,
}: {
  address: string;
  character: CharacterDefinition;
  state: OverrideState;
  onChange: (next: OverrideState) => void;
}) {
  const active = isOverrideActive(state);
  const recovering = isRecovering(state);

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => !active && onChange(buyCarteBlanche(address, character))}
        disabled={active}
        data-testid="buy-carte-blanche"
        title={
          active
            ? `Карт-бланш активен — осталось раундов: ${state.roundsRemaining}`
            : `Карт-бланш: ${CARTE_BLANCHE_ROUNDS} раунда без ограничений — ${CARTE_BLANCHE_PRICE}$`
        }
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base font-semibold transition ${
          active
            ? "cursor-not-allowed border-white/20 bg-fuchsia-500/20 text-fuchsia-200"
            : "border-white/10 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 text-fuchsia-200 hover:border-white/30"
        }`}
      >
        ∞
      </button>

      {recovering && (
        <button
          onClick={() => onChange(buyAftercare(address, character))}
          data-testid="buy-aftercare"
          title={`Забота: снять восстановление и часть последствий — ${AFTERCARE_PRICE}$`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-200 transition hover:border-white/30"
        >
          ♥
        </button>
      )}
    </div>
  );
}
