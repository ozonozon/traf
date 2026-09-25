"use client";

import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { BalanceCard } from "@/components/profile/BalanceCard";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { TransactionList } from "@/components/transactions/TransactionList";
import { ThemeSwitcherRow, ThemeToggleButton } from "@/components/theme/ThemeSwitcher";
import { useSession } from "@/components/telegram/TelegramProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useApi } from "@/lib/hooks";
import type { ProfileResponseDto } from "@/lib/types";

/** Экран «Профиль»: человек из Telegram, виртуальный баланс, статистика, история. */
export default function ProfilePage() {
  const session = useSession();
  // Ждём bootstrap сессии, иначе первый запрос уйдёт без cookie и вернёт 401.
  const { data, error, isLoading, refresh } = useApi<ProfileResponseDto>(
    session.isLoading ? null : "/api/profile",
  );
  const isPending = session.isLoading || isLoading;

  return (
    <AppFrame>
      <AppHeader />

      <main className="px-5 pt-6 pb-[calc(104px+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[clamp(38px,11vw,48px)] leading-none font-extrabold tracking-[-0.035em]">Профиль</h1>
          <ThemeToggleButton className="mt-1" />
        </div>

        {isPending ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="size-[76px] rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-[214px] rounded-[28px]" />
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[86px] rounded-[22px]" />
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <div className="mt-5">
            <ErrorState onRetry={refresh} />
          </div>
        ) : (
          <>
            <ProfileIdentity user={data.user} />

            {data.user.isDemo ? (
              <p className="mt-3 rounded-[14px] bg-surface px-3 py-2 text-[12px] text-muted">
                Демо-режим: приложение открыто вне Telegram (только для локальной разработки).
              </p>
            ) : null}

            <BalanceCard balance={data.user.balance} totalEarned={data.user.totalEarned} />

            <ProfileStats stats={data.stats} />

            <section className="mt-4 overflow-hidden rounded-[24px] border border-border bg-card">
              <ThemeSwitcherRow />
            </section>

            <section className="mt-8">
              <h2 className="text-[22px] tracking-[-0.02em]">История операций</h2>
              <p className="mt-1.5 text-[13px] text-muted">Все начисления — виртуальные</p>
              <div className="mt-3.5">
                <TransactionList />
              </div>
            </section>
          </>
        )}
      </main>
    </AppFrame>
  );
}
