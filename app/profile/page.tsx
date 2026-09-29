"use client";

import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { BalanceCard } from "@/components/profile/BalanceCard";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileStats, type ProfileStatsView } from "@/components/profile/ProfileStats";
import { TransactionList } from "@/components/transactions/TransactionList";
import { ThemeSwitcherRow, ThemeToggleButton } from "@/components/theme/ThemeSwitcher";
import { useSession } from "@/components/telegram/TelegramProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useApi } from "@/lib/hooks";
import type { ProfileResponseDto } from "@/lib/types";

/**
 * Экран «Профиль»: человек из Telegram, виртуальный баланс, статистика, история.
 *
 * Данные берутся из двух источников: ответ /api/profile (подписанное состояние из cookie)
 * и уже полученный при авторизации пользователь из сессии. Если запрос профиля не прошёл
 * (например, клиент Telegram не отдал cookie), экран всё равно показывает доступные данные
 * из локального состояния, а не ошибку загрузки.
 */
export default function ProfilePage() {
  const session = useSession();
  // Ждём bootstrap сессии, иначе первый запрос уйдёт без cookie.
  const { data, isLoading, refresh } = useApi<ProfileResponseDto>(session.isLoading ? null : "/api/profile");
  const isPending = session.isLoading || isLoading;

  const user = data?.user ?? session.user;
  const isFromServer = data !== null;
  const stats: ProfileStatsView | null =
    data?.stats ??
    (user
      ? {
          completedTasks: user.completedTasks,
          totalEarned: user.totalEarned,
          completedToday: null,
          rank: null,
        }
      : null);

  function handleRetry() {
    session.retry();
    refresh();
  }

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
        ) : user && stats ? (
          <>
            <ProfileIdentity user={user} />

            {user.isDemo ? (
              <p className="mt-3 rounded-[14px] bg-surface px-3 py-2 text-[12px] text-muted">
                Демо-режим: приложение открыто вне Telegram (только для локальной разработки).
              </p>
            ) : null}

            <BalanceCard balance={user.balance} totalEarned={user.totalEarned} />

            <ProfileStats stats={stats} />

            <section className="mt-4 overflow-hidden rounded-[24px] border border-border bg-card">
              <ThemeSwitcherRow />
            </section>

            <section className="mt-8">
              <h2 className="text-[22px] tracking-[-0.02em]">История операций</h2>
              <p className="mt-1.5 text-[13px] text-muted">Все начисления — виртуальные</p>
              <div className="mt-3.5">
                {isFromServer ? (
                  <TransactionList />
                ) : (
                  <p className="rounded-[18px] border border-border bg-surface px-3.5 py-3 text-[12.5px] leading-snug text-muted">
                    История операций и место в рейтинге подгружаются, когда приложение открыто внутри Telegram.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="mt-5">
            <ErrorState
              title="Профиль недоступен"
              description="Откройте приложение внутри Telegram и обновите экран — данные появятся автоматически."
              onRetry={handleRetry}
            />
          </div>
        )}
      </main>
    </AppFrame>
  );
}

