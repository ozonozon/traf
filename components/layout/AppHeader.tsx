"use client";

import { branding } from "@/config/branding";

import { BalancePill } from "./BalancePill";

/** Шапка: логотип + название + виртуальный баланс. */
export function AppHeader() {
  return (
    <header className="safe-top">
      <div className="flex items-center gap-3 px-5 pt-4 pb-1">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[19px] font-extrabold text-white"
          style={{ background: "var(--primary-gradient)" }}
          aria-hidden
        >
          {branding.logo}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-none font-extrabold tracking-[-0.01em]">{branding.name}</p>
          <p className="mt-1 text-[12px] leading-none text-muted">{branding.description}</p>
        </div>

        <BalancePill />
      </div>
    </header>
  );
}

