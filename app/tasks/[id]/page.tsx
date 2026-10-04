"use client";

import { ArrowLeft, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { AppFrame } from "@/components/layout/AppFrame";
import { BalancePill } from "@/components/layout/BalancePill";
import { TaskRunner } from "@/components/tasks/TaskRunner";
import { TelegramSubscription } from "@/components/tasks/TelegramSubscription";
import { TelegramIcon } from "@/components/ui/TelegramIcon";
import { useAuthedApi } from "@/lib/hooks";
import { TELEGRAM_SUBSCRIPTION_TASK_ID, TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "@/lib/task-constants";
import type { TaskDetailResponseDto } from "@/lib/types";
import { formatDeadline, formatRub } from "@/lib/utils";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";

/** Экран отдельного задания: условия, варианты ответа, свой текст, оценка. */
export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // Запрос уходит только после успешной Telegram-авторизации (useAuthedApi).
  const { data, error, isLoading, refresh } = useAuthedApi<TaskDetailResponseDto>(`/api/tasks/${id}`);
  const isPending = isLoading;
  const task = data?.task ?? null;
  const isSubscriptionTask = task?.type === TELEGRAM_SUBSCRIPTION_TASK_TYPE;

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tasks");
    }
  }

  return (
    <AppFrame withGrid>
      <div>
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <button
            type="button"
            onClick={handleBack}
            className="pressable -ml-1 flex items-center gap-1 rounded-full px-1 py-1 text-[15px] font-semibold text-muted"
          >
            <ArrowLeft size={18} />
            Назад
          </button>
          <BalancePill />
        </div>
      </div>

      <main className="px-5 pt-4 pb-[calc(130px+env(safe-area-inset-bottom,0px))]">
        {isPending ? (
          <div className="space-y-3.5">
            <Skeleton className="h-[184px] rounded-[24px]" />
            <Skeleton className="h-[72px] rounded-[18px]" />
            <Skeleton className="h-[96px] rounded-[24px]" />
            <Skeleton className="h-[220px] rounded-[24px]" />
          </div>
        ) : error ? (
          <ErrorState onRetry={refresh} />
        ) : task ? (
          <div className="space-y-3.5">
            <section className="card-surface p-5">
              <div className="flex size-16 items-center justify-center rounded-[20px] bg-primary-soft text-[32px] leading-none">
                {isSubscriptionTask ? (
                  <TelegramIcon size={34} className="text-primary" />
                ) : (
                  <span aria-hidden>{task.icon}</span>
                )}
              </div>

              <h1 className="mt-4 text-[26px] leading-[1.1] tracking-[-0.03em]">{task.title}</h1>
              <p className="mt-2 text-[14px] leading-snug text-muted">{task.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="text-[22px] leading-none font-extrabold text-primary">+{formatRub(task.reward)}</span>
                <span className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                  <Clock size={13} />
                  {formatDeadline(task.deadline)}
                </span>
              </div>
            </section>

            {task.state === "locked" ? (
              <section className="card-surface p-5">
                <div className="flex size-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
                  <Lock size={22} />
                </div>
                <h2 className="mt-3.5 text-[19px]">Задание пока недоступно</h2>
                <p className="mt-2 text-[14.5px] leading-snug text-muted">
                  Сначала выполните обязательное задание «Подписка на Telegram-каналы»: отправьте заявки на все три
                  канала. После того как Telegram подтвердит заявки, остальные задания откроются автоматически.
                </p>
                <Link
                  href={`/tasks/${TELEGRAM_SUBSCRIPTION_TASK_ID}`}
                  className="pressable mt-4 flex h-[54px] items-center justify-center rounded-[24px] bg-primary text-[16px] font-bold text-white"
                >
                  К заданию «Подписка»
                </Link>
              </section>
            ) : (
              <section className="card-surface p-5">
                <h2 className="text-[17px]">Условия задания</h2>
                <p className="mt-2.5 text-[14.5px] leading-snug">{task.conditions}</p>
                {isSubscriptionTask ? null : (
                  <p className="mt-2.5 text-[12.5px] text-muted">Виртуальный объект: {task.virtualTarget}</p>
                )}
              </section>
            )}

            {task.state === "locked" ? null : isSubscriptionTask ? (
              <TelegramSubscription task={task} />
            ) : (
              <TaskRunner task={task} />
            )}
          </div>
        ) : (
          <ErrorState title="Задание не найдено" description="Возможно, оно уже недоступно" onRetry={refresh} />
        )}
      </main>
    </AppFrame>
  );
}
