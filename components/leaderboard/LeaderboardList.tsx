"use client";

import { Avatar } from "@/components/ui/Avatar";
import { LeaderboardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAuthedApi } from "@/lib/hooks";
import type { LeaderboardCurrentUserDto, LeaderboardEntryDto, LeaderboardResponseDto } from "@/lib/types";
import { cn, formatRub, plural } from "@/lib/utils";

/** Бейдж места: золото / серебро / бронза для первых трёх. */
function RankBadge({ rank }: { rank: number }) {
  const gradient = rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : rank === 3 ? "var(--bronze)" : null;

  if (!gradient) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center text-[14px] font-extrabold text-muted">
        {rank}
      </span>
    );
  }

  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
      style={{ background: gradient }}
    >
      {rank}
    </span>
  );
}

function displayName(entry: { username: string | null; firstName: string; lastName: string | null }): string {
  if (entry.username) return `@${entry.username}`;
  return `${entry.firstName} ${entry.lastName ?? ""}`.trim();
}

/** Строка рейтинга. */
function LeaderboardRow({ entry }: { entry: LeaderboardEntryDto }) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3.5", entry.isCurrentUser && "bg-primary-soft")}>
      <RankBadge rank={entry.rank} />

      <Avatar
        firstName={entry.firstName}
        lastName={entry.lastName}
        username={entry.username}
        photoUrl={entry.photoUrl}
        size={44}
        ring={entry.isCurrentUser}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight font-bold">{displayName(entry)}</p>
        <p className="mt-1 text-[12px] leading-none text-muted">
          {entry.completedTasks} {plural(entry.completedTasks, "задание", "задания", "заданий")}
        </p>
      </div>

      <p className="shrink-0 text-[15px] font-extrabold">{formatRub(entry.totalEarned)}</p>
    </li>
  );
}

/** Блок текущего пользователя под ТОП-30: показывается, даже если он не попал в список. */
function CurrentUserBlock({ currentUser }: { currentUser: LeaderboardCurrentUserDto }) {
  return (
    <div className="card-surface mt-4 p-4">
      <p className="text-[11.5px] font-bold tracking-[0.08em] text-muted uppercase">
        {currentUser.isInTop ? "Вы в ТОП-30" : "Ваше место"}
      </p>

      {!currentUser.isInTop ? (
        <p className="mt-1.5 text-[28px] leading-none font-extrabold text-primary">#{currentUser.rank}</p>
      ) : null}

      <div className="mt-3.5 flex items-center gap-3">
        <Avatar
          firstName={currentUser.firstName}
          lastName={currentUser.lastName}
          username={currentUser.username}
          photoUrl={currentUser.photoUrl}
          size={44}
          ring
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-bold">{displayName(currentUser)}</p>
          <p className="mt-1 text-[12px] leading-none text-muted">Ваш заработок</p>
        </div>

        <p className="shrink-0 text-[15px] font-extrabold">{formatRub(currentUser.totalEarned)}</p>
      </div>
    </div>
  );
}

/**
 * ТОП-30 участников + отдельный блок текущего пользователя.
 * Список скроллится вместе со страницей — внутреннего scroll-контейнера нет.
 *
 * Данные запрашиваются через useAuthedApi: до завершения Telegram-авторизации запрос
 * не отправляется, при 401 выполняется один повторный вход, при смене сессии — перезапрос.
 */
export function LeaderboardList() {
  const { data, error, isLoading, refresh } = useAuthedApi<LeaderboardResponseDto>("/api/leaderboard");

  if (isLoading) return <LeaderboardSkeleton count={8} />;
  if (error) return <ErrorState onRetry={refresh} />;
  if (!data || data.entries.length === 0) {
    return <EmptyState title="Рейтинг пока пустой" description="Выполните первое задание, чтобы попасть в список." />;
  }

  return (
    <div>
      <ul className="card-surface divide-y divide-border overflow-hidden p-0">
        {data.entries.map((entry) => (
          <LeaderboardRow key={entry.id} entry={entry} />
        ))}
      </ul>

      {data.currentUser ? <CurrentUserBlock currentUser={data.currentUser} /> : null}
    </div>
  );
}

