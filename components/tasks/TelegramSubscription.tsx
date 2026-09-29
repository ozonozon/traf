"use client";

import { Check, Clock, Send } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/telegram/TelegramProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isApiError } from "@/lib/api";
import { hapticNotification, hapticSelection, openExternalLink } from "@/lib/telegram";
import type { SubmissionResponseDto, TaskChannelDto, TaskDetailDto } from "@/lib/types";
import { cn, formatRub } from "@/lib/utils";

import { TaskSuccess } from "./TaskSuccess";

/**
 * Задание «Подписка на Telegram-каналы».
 *
 * Три карточки с кнопкой «Подписаться» — каждая открывает свою постоянную invite-ссылку.
 * Статусы «Ожидаем запрос» / «Запрос отправлен» берутся ТОЛЬКО из серверного состояния:
 * true появляется после того, как Telegram прислал chat_join_request, а подписанный
 * тикет заявки был применён. Нажатие кнопки и открытие ссылки статус не меняют.
 * Подписки через getChatMember не проверяются.
 */
export function TelegramSubscription({ task }: { task: TaskDetailDto }) {
  const toast = useToast();
  const { setUser } = useSession();

  const channels = task.channels ?? [];
  const requestedCount = channels.filter((channel) => channel.requested).length;
  const allRequested = channels.length > 0 && requestedCount === channels.length;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reward, setReward] = useState<number | null>(
    task.state === "completed" ? (task.submission?.reward ?? task.reward) : null,
  );
  const [isFresh, setIsFresh] = useState(false);

  function handleSubscribe(channel: TaskChannelDto) {
    hapticSelection();
    // Ссылку открывает нативный метод Telegram: внутри Mini App переход остаётся в Telegram.
    // Статус канала от нажатия НЕ меняется: он появляется только после chat_join_request.
    openExternalLink(channel.url);
  }

  async function handleSubmit() {
    if (isSubmitting || !allRequested) return;

    setIsSubmitting(true);
    try {
      const response = await apiFetch<SubmissionResponseDto>("/api/submissions", {
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
        Отправьте заявку на вступление в {channels.length} канала. Статус появится после того, как Telegram пришлёт
        заявку — нажатие кнопки его не меняет.
      </p>

      {channels.map((channel) => {
        const isRequested = channel.requested;

        return (
          <section key={channel.id} className="card-surface p-4">
            <div className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
                <Send size={20} />
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
              {isRequested ? <Check size={14} /> : <Clock size={13} />}
              {isRequested ? "Запрос отправлен" : "Ожидаем запрос"}
            </p>

            <Button
              variant={isRequested ? "secondary" : "primary"}
              size="md"
              className="mt-3"
              onClick={() => handleSubscribe(channel)}
            >
              Подписаться
            </Button>
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[900px] border-t border-border bg-card/95 px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <Button
          variant={allRequested ? "primary" : "secondary"}
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!allRequested || isSubmitting}
        >
          {allRequested ? "Получить вознаграждение" : `Ожидаем заявки (${requestedCount}/${channels.length})`}
        </Button>
      </div>
    </div>
  );
}


