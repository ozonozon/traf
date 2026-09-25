"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TasksProgressDto } from "@/lib/types";

/** Заголовок блока заданий: «Выполнено X из Y» + «Осталось Z» + прогресс. */
export function TaskProgress({
  progress,
  isLoading,
}: {
  progress: TasksProgressDto | null;
  isLoading: boolean;
}) {
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const remaining = progress?.remaining ?? 0;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : (
          <>
            <p className="text-[13px] font-bold">
              Выполнено {completed} из {total}
            </p>
            <p className="text-[13px] font-semibold text-muted">Осталось {remaining}</p>
          </>
        )}
      </div>
      <ProgressBar className="mt-2.5" value={completed} max={Math.max(total, 1)} />
    </div>
  );
}
