import "server-only";

import { TELEGRAM_CHANNELS, publicChannels } from "@/config/telegram-channels";

import type { DemoTask } from "./demo-data";
import type { TaskCompletionRow } from "./db";
import { TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";
import type { SubmissionDto, TaskChannelDto, TaskListItemDto, TaskState } from "./types";

export { TELEGRAM_SUBSCRIPTION_TASK_TYPE };

/**
 * Данные каналов для задачи «Подписка на Telegram-каналы».
 * `requested` приходит из PostgreSQL (таблица channel_requests): true появляется
 * только после реального chat_join_request от Telegram. Нажатие кнопки не влияет.
 */
export function subscriptionTaskFields(
  type: string,
  requestedChannelIds: string[],
): {
  channels?: TaskChannelDto[];
} {
  if (type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE) return {};

  return {
    channels: publicChannels().map((channel) => ({
      ...channel,
      requested: requestedChannelIds.includes(channel.id),
    })),
  };
}

/** Все три заявки получены? */
export function isSubscriptionComplete(requestedChannelIds: string[]): boolean {
  return TELEGRAM_CHANNELS.every((channel) => requestedChannelIds.includes(channel.id));
}

/** Состояние задания для конкретного пользователя. */
export function computeTaskState(
  task: Pick<DemoTask, "status" | "type">,
  deadline: Date,
  isCompletedByUser: boolean,
  isLocked: boolean,
): TaskState {
  if (isCompletedByUser) return "completed";
  if (isLocked) return "locked";
  if (task.status === "PAUSED") return "paused";
  if (task.status !== "ACTIVE") return "expired";
  if (deadline.getTime() < Date.now()) return "expired";
  return "available";
}

export function serializeTaskSummary(task: DemoTask, deadline: Date, state: TaskState): TaskListItemDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    icon: task.icon,
    reward: task.reward,
    type: task.type,
    virtualTarget: task.virtualTarget,
    minLength: task.minLength,
    deadline: deadline.toISOString(),
    requiresRating: task.requiresRating,
    state,
  };
}

/**
 * Submission для интерфейса. Ответ и оценка в базе не хранятся (схема task_completions
 * содержит только задание и награду), поэтому для уже выполненных заданий показываются
 * награда и дата.
 */
export function serializeCompletion(completion: TaskCompletionRow): SubmissionDto {
  return {
    answer: "",
    rating: null,
    selectedOptionId: null,
    reward: Number(completion.reward),
    createdAt: new Date(completion.completed_at).toISOString(),
  };
}
