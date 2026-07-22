"use client";

import { SUBSCRIPTION_TIERS } from "@/lib/subscription/tiers";

export function SubscriptionTiers() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold text-transparent">
          Подписка
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Четыре уровня доступа — от знакомства до полного набора механик.
        </p>
        <p className="mt-1 text-xs text-amber-400/80">
          Оплата пока не подключена к интерфейсу — контракт поддерживает одну фиксированную
          цену, разные тарифы здесь показывают направление, а не реальную оплату.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-xl shadow-black/30 backdrop-blur-2xl ${
              tier.highlighted
                ? "border-fuchsia-400/40 bg-white/[0.09]"
                : "border-white/10 bg-white/[0.06]"
            }`}
          >
            {tier.highlighted && (
              <span className="w-fit rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Популярный
              </span>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/80">
                {tier.tagline}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">{tier.name}</h2>
              <p className="mt-1 text-2xl font-bold text-white">{tier.priceLabel}</p>
            </div>
            <ul className="flex-1 space-y-2 text-sm text-neutral-300">
              {tier.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <button
              data-testid={`subscribe-${tier.id}`}
              className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
            >
              Оформить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
