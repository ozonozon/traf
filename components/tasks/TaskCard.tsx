import { Check, Clock, Lock, Users } from "lucide-react";
import Link from "next/link";

import { TelegramIcon } from "@/components/ui/TelegramIcon";
import { hapticImpact } from "@/lib/telegram";
import type { TaskListItemDto } from "@/lib/types";
import { cn, formatDeadline, formatRub, plural } from "@/lib/utils";

/** Содержимое карточки (используется и для заблокированного задания — без ссылки). */
function TaskCardBody({ task }: { task: TaskListItemDto }) {
  const isCompleted = task.state === "completed";
  const isExpired = task.state === "expired";
  const isLocked = task.state === "locked";
  const isInactive = isCompleted || isExpired || isLocked;
  const isSubscription = task.type === "TELEGRAM_SUBSCRIPTION";
  const channelsCount = task.channels?.length ?? 0;

  return (
    <>
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-primary-soft text-[24px] leading-none">
        {isSubscription ? <TelegramIcon size={24} className="text-primary" /> : <span aria-hidden>{task.icon}</span>}
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
        ) : isLocked ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <Lock size={13} />
            Сначала подписка на каналы
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
      </div>
    </>
  );
}

/** Карточка задания на главном экране. */
export function TaskCard({ task }: { task: TaskListItemDto }) {
  const isLocked = task.state === "locked";

  if (isLocked) {
    // Заблокированное задание не открывается: сначала обязательное задание-подписка.
    return (
      <div className="card-surface flex items-center gap-3.5 p-4 opacity-65">
        <TaskCardBody task={task} />
      </div>
    );
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      onClick={() => hapticImpact("light")}
      className={cn("card-surface pressable flex items-center gap-3.5 p-4")}
    >
      <TaskCardBody task={task} />
    </Link>
  );
}

