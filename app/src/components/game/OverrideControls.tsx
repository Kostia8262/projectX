"use client";

import { useMutation } from "@tanstack/react-query";
import type { CharacterDefinition } from "@/lib/characters/registry";
import {
  AFTERCARE_PRICE,
  CARTE_BLANCHE_PRICE,
  CARTE_BLANCHE_ROUNDS,
  buyAftercare,
  buyCarteBlanche,
  isOverrideActive,
  isRecovering,
  type OverridePurchaseResult,
  type OverrideState,
} from "@/lib/characters/override";

// Two small icons, not a shop listing — bought on impulse mid-scene, not
// browsed. ∞ unlocks a few rounds with every gate lifted (see
// isImplementBlocked's `overriding` param); ♥ only appears once there's
// actually an aftercare debuff to relieve (see applyAftercareDebuff). Both
// charge real shop coins server-side (see api/game/carte-blanche and
// api/game/aftercare) — same balance as the accessory shop.
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

  const carteBlanche = useMutation({
    mutationFn: () => buyCarteBlanche(address, character),
    onSuccess: (result: OverridePurchaseResult) => onChange(result.state),
  });
  const aftercare = useMutation({
    mutationFn: () => buyAftercare(address, character),
    onSuccess: (result: OverridePurchaseResult) => onChange(result.state),
  });

  const carteBlancheError = carteBlanche.data && !carteBlanche.data.ok ? carteBlanche.data.error : null;
  const aftercareError = aftercare.data && !aftercare.data.ok ? aftercare.data.error : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => !active && !carteBlanche.isPending && carteBlanche.mutate()}
          disabled={active || carteBlanche.isPending}
          data-testid="buy-carte-blanche"
          title={
            active
              ? `Карт-бланш активен — осталось раундов: ${state.roundsRemaining}`
              : `Карт-бланш: ${CARTE_BLANCHE_ROUNDS} раунда без ограничений — ${CARTE_BLANCHE_PRICE} монет`
          }
          className={`flex h-9 w-9 items-center justify-center rounded-xl border text-base font-semibold transition ${
            active
              ? "cursor-not-allowed border-white/20 bg-fuchsia-500/20 text-fuchsia-200"
              : "border-white/10 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 text-fuchsia-200 hover:border-white/30 disabled:opacity-50"
          }`}
        >
          {carteBlanche.isPending ? "…" : "∞"}
        </button>

        {recovering && (
          <button
            onClick={() => !aftercare.isPending && aftercare.mutate()}
            disabled={aftercare.isPending}
            data-testid="buy-aftercare"
            title={`Забота: снять восстановление и часть последствий — ${AFTERCARE_PRICE} монет`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-200 transition hover:border-white/30 disabled:opacity-50"
          >
            {aftercare.isPending ? "…" : "♥"}
          </button>
        )}
      </div>
      {(carteBlancheError || aftercareError) && (
        <p className="text-[10px] text-rose-400" data-testid="override-error">
          {carteBlancheError ?? aftercareError}
        </p>
      )}
    </div>
  );
}
