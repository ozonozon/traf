"use client";

import { branding } from "@/config/branding";

import { BalancePill } from "./BalancePill";

/** Шапка: логотип + название + виртуальный баланс. */
export function AppHeader() {
  return (
    <header className="safe-top">
      <div className="flex items-center gap-3 px-5 pt-4 pb-1">
        {/* Контейнер сохраняет прежний размер (44px) и скругление; картинка не растягивается. */}
        {/* Локальная иконка из public/: обычный <img>, оптимизация next/image здесь не нужна. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logoUrl}
          alt={branding.name}
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-[14px] object-contain"
          style={{ background: "var(--primary-gradient)" }}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-none font-extrabold tracking-[-0.01em]">{branding.name}</p>
          <p className="mt-1 text-[12px] leading-none text-muted">{branding.description}</p>
        </div>

        <BalancePill />
      </div>
    </header>
  );
}

