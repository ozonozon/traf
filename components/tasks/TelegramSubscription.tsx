"use client";

import { Check, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/telegram/TelegramProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { isApiError } from "@/lib/api";
import { hapticNotification, hapticSelection, openExternalLink } from "@/lib/telegram";
import type { ChannelRequestsResponseDto, SubmissionResponseDto, TaskChannelDto, TaskDetailDto } from "@/lib/types";
import { cn, formatRub } from "@/lib/utils";

import { TaskSuccess } from "./TaskSuccess";

/**
 * Задание «Подписка на Telegram-каналы».
 *
 * Три карточки с кнопкой «ПОДАТЬ ЗАЯВКУ» — каждая открывает постоянную invite-ссылку канала.
 * Клик по кнопке НИЧЕГО не засчитывает: заявка считается отправленной только после того,
 * как Telegram прислал webhook-событие chat_join_request и сервер записал её в PostgreSQL.
 * Статусы подтягиваются кнопкой «ПРОВЕРИТЬ ЗАЯВКИ» (GET /api/channel-requests).
 */
export function TelegramSubscription({ task }: { task: TaskDetailDto }) {
  const toast = useToast();
  const { setUser, authedFetch } = useSession();

  const [channels, setChannels] = useState<TaskChannelDto[]>(task.channels ?? []);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reward, setReward] = useState<number | null>(
    task.state === "completed" ? (task.submission?.reward ?? task.reward) : null,
  );
  const [isFresh, setIsFresh] = useState(false);

  const requestedCount = channels.filter((channel) => channel.requested).length;
  const allRequested = channels.length > 0 && requestedCount === channels.length;

  function handleSubscribe(channel: TaskChannelDto) {
    hapticSelection();
    // Ссылку открывает нативный метод Telegram: внутри Mini App переход остаётся в Telegram.
    // Статус канала от этого клика НЕ меняется.
    openExternalLink(channel.url);
  }

  /** Запрашивает реальные статусы заявок из PostgreSQL. Кнопка доступна всегда. */
  async function handleCheck() {
    if (isChecking) return;

    setIsChecking(true);
    try {
      const response = await authedFetch<ChannelRequestsResponseDto>("/api/channel-requests");
      setChannels((current) =>
        current.map((channel) => {
          const fresh = response.channels.find((item) => item.id === channel.id);
          return fresh ? { ...channel, requested: fresh.requested } : channel;
        }),
      );
      setHasChecked(true);
      hapticNotification(response.allRequested ? "success" : "warning");
      toast.show(`Заявки: ${response.requestedCount} из ${response.total}`, {
        description: response.allRequested
          ? "Все заявки подтверждены — задание можно завершить"
          : "Отправь заявки через кнопки выше и проверь ещё раз",
        variant: response.allRequested ? "success" : "default",
      });
    } catch (cause) {
      hapticNotification("error");
      toast.show("Не удалось проверить заявки", {
        description: isApiError(cause) ? cause.message : "Попробуйте позже",
        variant: "error",
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit() {
    if (isSubmitting || !allRequested) return;

    setIsSubmitting(true);
    try {
      const response = await authedFetch<SubmissionResponseDto>("/api/submissions", {
        json: { taskId: task.id },
      });
      setUser(response.user);
      setReward(response.reward);
      setIsFresh(true);
      hapticNotification("success");
      toast.show("Задание выполнено", {
        description: `+${formatRub(response.reward)} добавлено · виртуально`,
        variant: "success",
      });
    } catch (cause) {
      const code = isApiError(cause) ? cause.code : "REQUEST_FAILED";
      hapticNotification("error");
      toast.show("Не удалось выполнить задание", {
        description: isApiError(cause) ? cause.message : "Попробуйте позже",
        variant: "error",
      });
      if (code === "TASK_ALREADY_COMPLETED") {
        setReward(task.reward);
        setIsFresh(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reward !== null) {
    return <TaskSuccess reward={reward} answer={task.submission?.answer ?? ""} isFresh={isFresh} />;
  }

  return (
    <div className="space-y-3.5">
      <p className="px-1 text-[13px] leading-snug text-muted">
        Подай заявку во все {channels.length} канала — у каждого своя кнопка «ПОДАТЬ ЗАЯВКУ». Когда заявки будут
        отправлены, нажми «ПРОВЕРИТЬ ЗАЯВКИ».
      </p>

      {channels.map((channel, index) => {
        const isRequested = channel.requested;

        return (
          <section key={channel.id} className="card-surface p-4">
            <div className="flex items-center gap-3.5">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold",
                  isRequested ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] leading-tight font-bold">{channel.title}</p>
                <p className="mt-1 truncate text-[12.5px] leading-none text-muted">{channel.description}</p>
              </div>
            </div>

            <p
              className={cn(
                "mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold",
                isRequested ? "text-success" : "text-muted",
              )}
            >
              {isRequested ? <Check size={14} strokeWidth={3} /> : <Clock size={13} />}
              {isRequested ? "Заявка отправлена" : "Ожидаем заявку"}
            </p>

            <Button
              variant={isRequested ? "secondary" : "primary"}
              size="md"
              className="mt-3"
              onClick={() => handleSubscribe(channel)}
            >
              ПОДАТЬ ЗАЯВКУ
            </Button>
          </section>
        );
      })}

      <section className="card-surface p-4">
        <p className="text-[15.5px] font-bold">Заявки: {requestedCount} из {channels.length}</p>

        {allRequested ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <Check size={15} strokeWidth={3} />
            Все заявки подтверждены
          </p>
        ) : hasChecked && requestedCount === 0 ? (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Пока ни одной заявки не найдено. Отправь заявки через кнопки выше и нажми «Проверить заявки» ещё раз.
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Заявка засчитывается только после того, как Telegram пришлёт её на сервер.
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[900px] border-t border-border bg-card/95 px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        {allRequested ? (
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Получить вознаграждение
          </Button>
        ) : (
          <Button variant="primary" onClick={handleCheck} isLoading={isChecking}>
            {isChecking ? null : <RefreshCw size={17} />}
            ПРОВЕРИТЬ ЗАЯВКИ
          </Button>
        )}
      </div>
    </div>
  );
}


