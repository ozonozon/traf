"use client";

import { useState } from "react";

import { VirtualNote } from "@/components/ui/VirtualNote";
import { formatRub } from "@/lib/utils";

import { ExchangeSheet } from "./ExchangeSheet";

/** Большая карточка виртуального баланса + игровой обмен. */
export function BalanceCard({ balance, totalEarned }: { balance: number; totalEarned: number }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <section
        className="mt-4 rounded-[28px] p-5 text-white"
        style={{ background: "var(--primary-gradient)", boxShadow: "var(--app-shadow-float)" }}
      >
        <p className="text-[11.5px] font-bold tracking-[0.16em] text-white/75 uppercase">Доступно к выводу</p>
        <p className="mt-2.5 text-[40px] leading-none font-extrabold tracking-[-0.03em]">{formatRub(balance)}</p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-white/15 px-4 py-3">
          <span className="text-[11.5px] font-bold tracking-[0.06em] text-white/80 uppercase">
            Заработано всего
          </span>
          <span className="text-[16px] font-extrabold">{formatRub(totalEarned)}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="pressable mt-3 h-[54px] w-full rounded-[24px] bg-accent-surface text-[16px] font-bold text-accent-surface-text"
        >
          Вывести деньги
        </button>
      </section>

      <VirtualNote className="mt-3">
        Виртуальный баланс — игровая статистика внутри приложения. Реального вывода средств, карт и платежей нет.
      </VirtualNote>

      <ExchangeSheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </>
  );
}
