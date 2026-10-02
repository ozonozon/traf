"use client";

import { Check, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/telegram/TelegramProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isApiError } from "@/lib/api";
import { hapticNotification, hapticSelection, openExternalLink } from "@/lib/telegram";
import type { ChannelSubscriptionsResponseDto, SubmissionResponseDto, TaskChannelDto, TaskDetailDto } from "@/lib/types";
import { cn, formatRub, getErrorMessage } from "@/lib/utils";

import { TaskSuccess } from "./TaskSuccess";

/**
 * Обязательное задание «Подписка на Telegram-каналы».
 *
 * Кнопка «ПОДПИСАТЬСЯ» только открывает invite-ссылку канала (Telegram.WebApp.openTelegramLink)
 * и ничего не засчитывает. Подписку определяет исключительно сервер: GET /api/channel-subscriptions
 * вызывает Telegram Bot API getChatMember для каждого канала. Награда выдаётся после того,
 * как сервер повторно подтвердит все три подписки.
 */
export function TelegramSubscription({ task }: { task: TaskDetailDto }) {
  const toast = useToast();
  const { setUser } = useSession();

  // Каналы приходят с сервера из config/telegram-channels.ts (без chatId) —
  // список отдаётся всегда, даже если запрос ушёл без авторизации.
  const [channels, setChannels] = useState<TaskChannelDto[]>(task.channels ?? []);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reward, setReward] = useState<number | null>(
    task.state === "completed" ? (task.submission?.reward ?? task.reward) : null,
  );
  const [isFresh, setIsFresh] = useState(false);

  const subscribedCount = channels.filter((channel) => channel.subscribed).length;
  const allSubscribed = channels.length > 0 && subscribedCount === channels.length;

  function handleSubscribe(channel: TaskChannelDto) {
    hapticSelection();
    // Открывает канал в Telegram. Подписка здесь НЕ засчитывается — только сервер.
    openExternalLink(channel.inviteLink);
  }

  /** Спрашивает у сервера фактическую подписку (getChatMember) по всем каналам. */
  async function handleCheck() {
    if (isChecking) return;

    setIsChecking(true);
    try {
      // Запрос идёт через общий apiFetch: initData WebApp подставляется в заголовок
      // X-Telegram-Init-Data, сервер валидирует его и берёт telegram_id оттуда.
      // Ни cookie, ни повторный вход для проверки подписки не нужны.
      const response = await apiFetch<ChannelSubscriptionsResponseDto>("/api/channel-subscriptions");
      setChannels((current) =>
        current.map((channel) => {
          const fresh = response.channels.find((item) => item.id === channel.id);
          return fresh ? { ...channel, subscribed: fresh.subscribed } : channel;
        }),
      );
      setHasChecked(true);
      hapticNotification(response.allSubscribed ? "success" : "warning");
      toast.show(`Подписки: ${response.subscribedCount} из ${response.total}`, {
        description: response.allSubscribed
          ? "Все подписки подтверждены — задание можно завершить"
          : "Подпишитесь на каналы выше и проверьте ещё раз",
        variant: response.allSubscribed ? "success" : "default",
      });
    } catch (cause) {
      hapticNotification("error");
      const code = isApiError(cause) ? cause.code : "REQUEST_FAILED";
      toast.show("Не удалось проверить подписку", {
        description: isApiError(cause) ? cause.message : getErrorMessage(code),
        variant: "error",
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit() {
    if (isSubmitting || !allSubscribed) return;

    setIsSubmitting(true);
    try {
      // Сервер сам повторно проверяет подписку через getChatMember перед начислением.
      // initData уходит тем же заголовком, поэтому награда не зависит от cookie.
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
        description: isApiError(cause) ? cause.message : getErrorMessage(code),
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
        Подпишись на все {channels.length} канала — у каждого своя кнопка «ПОДПИСАТЬСЯ». Когда подписки будут
        оформлены, нажми «ПРОВЕРИТЬ ПОДПИСКУ».
      </p>

      {channels.map((channel, index) => {
        const isSubscribed = channel.subscribed;

        return (
          <section key={channel.id} className="card-surface p-4">
            <div className="flex items-center gap-3.5">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold",
                  isSubscribed ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
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
                isSubscribed ? "text-success" : hasChecked ? "text-error" : "text-muted",
              )}
            >
              {isSubscribed ? <Check size={14} strokeWidth={3} /> : <Clock size={13} />}
              {isSubscribed ? "Подписка подтверждена" : hasChecked ? "Не подписан" : "Подписка не проверена"}
            </p>

            <Button
              variant={isSubscribed ? "secondary" : "primary"}
              size="md"
              className="mt-3"
              onClick={() => handleSubscribe(channel)}
            >
              ПОДПИСАТЬСЯ
            </Button>
          </section>
        );
      })}

      <section className="card-surface p-4">
        <p className="text-[15.5px] font-bold">
          Подписки: {subscribedCount} из {channels.length}
        </p>

        {allSubscribed ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <Check size={15} strokeWidth={3} />
            Все подписки подтверждены
          </p>
        ) : hasChecked ? (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Telegram подтвердил {subscribedCount} из {channels.length}. Подпишитесь на остальные каналы и нажмите
            «ПРОВЕРИТЬ ПОДПИСКУ» ещё раз.
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Подписка засчитывается только по данным Telegram — после нажатия «ПРОВЕРИТЬ ПОДПИСКУ».
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[900px] border-t border-border bg-card/95 px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        {allSubscribed ? (
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            ПОЛУЧИТЬ ВОЗНАГРАЖДЕНИЕ
          </Button>
        ) : (
          <Button variant="primary" onClick={handleCheck} isLoading={isChecking}>
            {isChecking ? null : <RefreshCw size={17} />}
            ПРОВЕРИТЬ ПОДПИСКУ
          </Button>
        )}
      </div>
    </div>
  );
}


