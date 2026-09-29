import "server-only";

import { publicChannels } from "@/config/telegram-channels";

import type { DemoTask } from "./demo-data";
import { allChannelsRequested, isChannelRequested, type ChannelIndex, type StoredSubmission, type UserState } from "./store";
import { TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";
import type { SubmissionDto, TaskChannelDto, TaskListItemDto, TaskState } from "./types";

export { TELEGRAM_SUBSCRIPTION_TASK_TYPE };

/**
 * Данные каналов для задачи «Подписка на Telegram-каналы».
 * `requested` берётся ТОЛЬКО из подписанного состояния (cookie): true появляется
 * исключительно после того, как Telegram прислал chat_join_request и подписанный
 * тикет заявки был применён. Ни нажатие кнопки, ни открытие ссылки не влияют.
 */
export function subscriptionTaskFields(
  type: string,
  state: UserState | null,
): {
  channels?: TaskChannelDto[];
} {
  if (type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE) return {};

  return {
    channels: publicChannels().map((channel) => ({
      ...channel,
      requested: state ? isChannelRequested(state, channel.index as ChannelIndex) : false,
    })),
  };
}

/** Обязательное задание выполнено (все три заявки получены)? */
export function isSubscriptionComplete(state: UserState | null): boolean {
  return allChannelsRequested(state);
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

export function serializeSubmission(submission: StoredSubmission): SubmissionDto {
  return {
    answer: submission.answer,
    rating: submission.rating,
    selectedOptionId: submission.selectedOptionId,
    reward: submission.reward,
    createdAt: submission.createdAt,
  };
}

