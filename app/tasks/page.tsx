"use client";

import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { TaskStats } from "@/components/tasks/TaskStats";
import { useAuthedApi } from "@/lib/hooks";
import type { TasksResponseDto } from "@/lib/types";

import { TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

/** Главный экран: hero, статистика, задания на сегодня. */
export default function TasksPage() {
  // Запрос уходит только после успешной Telegram-авторизации (useAuthedApi).
  const { data, error, isLoading, refresh } = useAuthedApi<TasksResponseDto>("/api/tasks");
  const isPending = isLoading;
  const tasks = data?.tasks ?? [];

  return (
    <AppFrame withGrid>
      <AppHeader />

      <main className="px-5 pt-6 pb-[calc(104px+env(safe-area-inset-bottom,0px))]">
        <section>
          <h1 className="text-[clamp(42px,12vw,58px)] leading-[1.03] font-extrabold tracking-[-0.035em]">
            Пиши отзывы.
            <br />
            Получай рубли.
          </h1>

          <p className="mt-3.5 max-w-[340px] text-[15px] leading-snug text-muted">
            Мы собираем задания от брендов и бизнесов, за выполнение которых вы получаете награждение
          </p>
        </section>

        <div className="mt-6">
          <TaskStats />
        </div>

        <section className="mt-8">
          <h2 className="text-[26px] tracking-[-0.03em]">Задания на сегодня</h2>

          <TaskProgress progress={data?.progress ?? null} isLoading={isPending} />

          <div className="mt-4 space-y-3">
            {isPending ? (
              <TaskListSkeleton count={3} />
            ) : error ? (
              <ErrorState onRetry={refresh} />
            ) : tasks.length === 0 ? (
              <EmptyState title="Новых заданий пока нет" description="Новые задания появятся позже." />
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        </section>
      </main>
    </AppFrame>
  );
}
