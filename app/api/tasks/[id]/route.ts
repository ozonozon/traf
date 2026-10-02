import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { getCompletedTaskIds, getTaskCompletion } from "@/lib/db";
import { findDemoTask, resolveDeadline } from "@/lib/demo-data";
import { RouteError, handleRouteError, jsonOk } from "@/lib/http";
import {
  TELEGRAM_SUBSCRIPTION_TASK_TYPE,
  computeTaskState,
  isSubscriptionTaskDone,
  publicSubscriptionChannels,
  serializeCompletion,
  serializeTaskSummary,
  subscriptionTaskFields,
} from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tasks/[id] — задание, его варианты ответов и результат текущего пользователя. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    const task = findDemoTask(id);
    if (!task) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }
    if (task.status === "PAUSED") {
      throw new RouteError("TASK_NOT_ACTIVE", "Задание больше не доступно", 404);
    }

    const [completion, completedIds] = user
      ? await Promise.all([getTaskCompletion(user.telegram_id, task.id), getCompletedTaskIds(user.telegram_id)])
      : [null, []];

    // Статусы каналов — из серверной проверки Telegram Bot API getChatMember.
    // Без авторизации отдаём публичный список каналов (subscribed: false), чтобы
    // карточки и кнопки «ПОДПИСАТЬСЯ» были видны всегда.
    const subscriptionCheck =
      user && task.type === TELEGRAM_SUBSCRIPTION_TASK_TYPE && !completion
        ? await checkChannelSubscriptions(user.telegram_id).catch(() => null)
        : null;

    const deadline = resolveDeadline();
    const isLocked = task.type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE && !isSubscriptionTaskDone(completedIds);
    const state = computeTaskState(task, deadline, Boolean(completion), isLocked);

    return jsonOk({
      task: {
        ...serializeTaskSummary(task, deadline, state),
        ...subscriptionTaskFields(task.type, subscriptionCheck?.channels ?? publicSubscriptionChannels()),
        conditions: task.conditions,
        options: task.options.map((option) => ({ id: option.id, text: option.text })),
        submission: completion ? serializeCompletion(completion) : null,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
