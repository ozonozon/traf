import { Check, Clock, Send, Users } from "lucide-react";
import Link from "next/link";

import { hapticImpact } from "@/lib/telegram";
import type { TaskListItemDto } from "@/lib/types";
import { cn, formatDeadline, formatRub, plural } from "@/lib/utils";

/** Карточка задания на главном экране. */
export function TaskCard({ task }: { task: TaskListItemDto }) {
  const isCompleted = task.state === "completed";
  const isExpired = task.state === "expired";
  const isInactive = isCompleted || isExpired;
  const isSubscription = task.type === "TELEGRAM_SUBSCRIPTION";
  const channelsCount = task.channels?.length ?? 0;

  return (
    <Link
      href={`/tasks/${task.id}`}
      onClick={() => hapticImpact("light")}
      className={cn(
        "card-surface pressable flex items-center gap-3.5 p-4",
        isInactive && "opacity-65",
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-primary-soft text-[24px] leading-none">
        {isSubscription ? <Send size={22} className="text-primary" /> : <span aria-hidden>{task.icon}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[16.5px] leading-tight font-bold">{task.title}</p>

        {isCompleted ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-success">
            <Check size={14} strokeWidth={3} />
            Выполнено
          </p>
        ) : isExpired ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <Clock size={13} />
            Завершено
          </p>
        ) : isSubscription ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            <Users size={13} />
            Подпишитесь на {channelsCount} {plural(channelsCount, "канал", "канала", "каналов")}
          </p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            <Clock size={13} />
            {formatDeadline(task.deadline)}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-[16.5px] font-extrabold", isInactive ? "text-muted" : "text-primary")}>
          +{formatRub(task.reward)}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted">виртуально</p>
      </div>
    </Link>
  );
}

