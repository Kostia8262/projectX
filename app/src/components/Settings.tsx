"use client";

import { useState } from "react";
import { useSiweSession } from "@/hooks/useSiweSession";

export function Settings({ address }: { address: string }) {
  const { signOut } = useSiweSession();
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
      <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-center text-2xl font-bold text-transparent">
        Настройки
      </h1>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
        <p className="text-xs text-neutral-400">Кошелёк</p>
        <p className="mt-1 font-mono text-sm text-white">{address}</p>
        <button
          onClick={() => signOut.mutate()}
          className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white/30 hover:text-white"
        >
          Выйти
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/30 backdrop-blur-2xl">
        <ToggleRow label="Звук" value={sound} onChange={setSound} />
        <ToggleRow label="Вибрация" value={haptics} onChange={setHaptics} />
        <p className="text-[11px] text-neutral-500">Плейсхолдеры — реального звука/вибрации пока нет.</p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left"
    >
      <span className="text-sm text-white">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          value ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
