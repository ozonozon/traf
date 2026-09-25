import "server-only";

import { hasUnconfiguredChannels, publicChannels } from "@/config/telegram-channels";

import type { TaskModel, TaskSubmissionModel } from "./generated/prisma/models";
import { TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";
import type { SubmissionDto, TaskChannelDto, TaskListItemDto, TaskState } from "./types";

export { TELEGRAM_SUBSCRIPTION_TASK_TYPE };

/**
 * Публичные данные каналов для задач «Подписка на Telegram-каналы».
 * Bot token, chat_id и прочие служебные поля на фронтенд не уходят.
 */
export function subscriptionTaskFields(type: string): {
  channels?: TaskChannelDto[];
  channelsConfigured?: boolean;
} {
  if (type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE) return {};
  return { channels: publicChannels(), channelsConfigured: !hasUnconfiguredChannels() };
}

/** Состояние задания для конкретного пользователя. */
export function computeTaskState(
  task: Pick<TaskModel, "status" | "deadline">,
  isCompletedByUser: boolean,
): TaskState {
  if (isCompletedByUser) return "completed";
  if (task.status === "PAUSED") return "paused";
  if (task.status === "COMPLETED" || task.status === "EXPIRED") return "expired";
  if (task.deadline.getTime() < Date.now()) return "expired";
  return "available";
}

export function serializeTaskSummary(task: TaskModel, state: TaskState): TaskListItemDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    icon: task.icon,
    reward: task.reward,
    type: task.type,
    virtualTarget: task.virtualTarget,
    minLength: task.minLength,
    deadline: task.deadline.toISOString(),
    requiresRating: task.requiresRating,
    state,
  };
}

export function serializeSubmission(submission: TaskSubmissionModel): SubmissionDto {
  return {
    answer: submission.answer,
    rating: submission.rating,
    selectedOptionId: submission.selectedOptionId,
    reward: submission.reward,
    createdAt: submission.createdAt.toISOString(),
  };
}
