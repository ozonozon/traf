"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/components/telegram/TelegramProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { VirtualNote } from "@/components/ui/VirtualNote";
import { apiFetch, isApiError } from "@/lib/api";
import { hapticNotification, hapticSelection, openExternalLink } from "@/lib/telegram";
import type { SubmissionResponseDto, TaskChannelDto, TaskDetailDto } from "@/lib/types";
import { cn, formatRub } from "@/lib/utils";

import { TaskSuccess } from "./TaskSuccess";

/**
 * Состояния канала в UI.
 * «Подписка подтверждена» появляется ТОЛЬКО из ответа backend —
 * клиент не может сам решить, что задание выполнено.
 */
type ChannelStatus = "not_checked" | "request_sent" | "checking" | "joined" | "not_joined";

const STATUS_META: Record<ChannelStatus, { text: string; className: string }> = {
  not_checked: { text: "○ Не проверено", className: "text-muted" },
  request_sent: { text: "✓ Заявка отправлена", className: "text-primary" },
  checking: { text: "Проверяем...", className: "text-muted" },
  joined: { text: "✓ Подписка подтверждена", className: "text-success" },
  not_joined: { text: "✗ Подписка не найдена", className: "text-error" },
};

interface ChannelStatusPayload {
  channels?: Array<{ id: string; status: string }>;
}

function statusFromBackend(status: string): ChannelStatus {
  return status === "joined" ? "joined" : "not_joined";
}

/** Задание «Подписка на Telegram-каналы»: карточки каналов + серверная проверка подписок. */
export function TelegramSubscription({ task }: { task: TaskDetailDto }) {
  const toast = useToast();
  const { setUser } = useSession();

  const channels = task.channels ?? [];
  const isConfigured = task.channelsConfigured ?? false;

  const [statuses, setStatuses] = useState<Record<string, ChannelStatus>>(() =>
    Object.fromEntries(channels.map((channel) => [channel.id, "not_checked" as ChannelStatus])),
  );
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reward, setReward] = useState<number | null>(
    task.state === "completed" ? (task.submission?.reward ?? task.reward) : null,
  );
  const [isFresh, setIsFresh] = useState(false);

  const allRequested = channels.every((channel) => {
    const status = statuses[channel.id];
    return status === "request_sent" || status === "joined";
  });

  function handleSubscribe(channel: TaskChannelDto) {
    hapticSelection();
    openExternalLink(channel.url);
    setStatuses((current) => ({ ...current, [channel.id]: "request_sent" }));
  }

  function resetStatuses() {
    setStatuses(Object.fromEntries(channels.map((channel) => [channel.id, "not_checked" as ChannelStatus])));
  }

  async function handleCheck() {
    if (isChecking) return;

    setIsChecking(true);
    setMessage(null);
    setStatuses(Object.fromEntries(channels.map((channel) => [channel.id, "checking" as ChannelStatus])));

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
      const details = isApiError(cause) ? (cause.details as ChannelStatusPayload | undefined) : undefined;
      if (details?.channels?.length) {
        setStatuses((current) => {
          const next = { ...current };
          for (const channel of details.channels ?? []) {
            next[channel.id] = statusFromBackend(channel.status);
          }
          return next;
        });
      } else {
        resetStatuses();
      }

      const text = isApiError(cause) ? cause.message : "Не удалось проверить подписки";
      setMessage(text);
      hapticNotification("error");
      toast.show("Проверка не пройдена", { description: text, variant: "error" });

      if (isApiError(cause) && cause.code === "TASK_ALREADY_COMPLETED") {
        setReward(task.reward);
        setIsFresh(false);
      }
    } finally {
      setIsChecking(false);
    }
  }

  if (reward !== null) {
    return <TaskSuccess reward={reward} answer={task.submission?.answer ?? ""} isFresh={isFresh} />;
  }

  return (
    <div className="space-y-3.5">
      <VirtualNote>
        Подпишитесь на все {channels.length} канала и нажмите «Проверить подписки». Подписку проверяет сервер через
        Telegram Bot API — «Подписка подтверждена» появляется только после реальной проверки.
      </VirtualNote>

      {channels.map((channel) => {
        const status = statuses[channel.id] ?? "not_checked";
        const meta = STATUS_META[status];

        return (
          <section key={channel.id} className="card-surface p-4">
            <div className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
                <Send size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] leading-tight font-bold">{channel.title}</p>
                <p className="mt-1 truncate text-[12.5px] leading-none text-muted">{channel.username}</p>
              </div>
            </div>

            <p className={cn("mt-3 text-[12.5px] font-semibold", meta.className)}>{meta.text}</p>

            <Button variant="secondary" size="md" className="mt-3" onClick={() => handleSubscribe(channel)}>
              Подписаться
            </Button>
          </section>
        );
      })}

      {!isConfigured ? (
        <VirtualNote>
          Каналы ещё не настроены. Проверка подписок станет доступна после подключения каналов.
        </VirtualNote>
      ) : null}

      {message ? (
        <p className="px-1 text-center text-[13px] leading-snug font-semibold text-error">{message}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[900px] border-t border-border bg-card/95 px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <Button
          variant={allRequested ? "primary" : "secondary"}
          onClick={handleCheck}
          isLoading={isChecking}
          disabled={isChecking}
        >
          {isChecking ? "Проверяем..." : "Проверить подписки"}
        </Button>
      </div>
    </div>
  );
}
