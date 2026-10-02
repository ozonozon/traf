import "server-only";

import type { DemoTask } from "./demo-data";
import type { TaskCompletionRow } from "./db";
import { TELEGRAM_SUBSCRIPTION_TASK_ID, TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";
import type { ChannelSubscriptionDto, SubmissionDto, TaskChannelDto, TaskListItemDto, TaskState } from "./types";

export { TELEGRAM_SUBSCRIPTION_TASK_TYPE };

/**
 * Данные каналов для задания «Подписка на Telegram-каналы».
 *
 * `subscribed` приходит из серверной проверки Telegram Bot API (`getChatMember`,
 * lib/channel-subscriptions.ts) — то есть это факт подписки, а не нажатие кнопки.
 */
export function subscriptionTaskFields(
  type: string,
  channels: ChannelSubscriptionDto[],
): {
  channels?: TaskChannelDto[];
} {
  if (type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE) return {};

  return {
    channels: channels.map((channel) => ({
      index: channel.index,
      id: channel.id,
      title: channel.title,
      description: channel.description,
      inviteLink: channel.inviteLink,
      subscribed: channel.subscribed,
    })),
  };
}

/**
 * Обязательное задание выполнено? Опираемся на факт начисления награды за него
 * (награда выдаётся только после серверной проверки всех подписок), поэтому
 * остальные задания разблокируются после получения награды — без лишних запросов
 * в Telegram Bot API на каждом открытии списка заданий.
 */
export function isSubscriptionTaskDone(completedTaskIds: string[]): boolean {
  return completedTaskIds.includes(TELEGRAM_SUBSCRIPTION_TASK_ID);
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
