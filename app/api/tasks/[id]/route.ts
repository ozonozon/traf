import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getRequestedChannelIds, getTaskCompletion } from "@/lib/db";
import { findDemoTask, resolveDeadline } from "@/lib/demo-data";
import { RouteError, handleRouteError, jsonOk } from "@/lib/http";
import {
  TELEGRAM_SUBSCRIPTION_TASK_TYPE,
  computeTaskState,
  isSubscriptionComplete,
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

    const [completion, requestedChannelIds] = user
      ? await Promise.all([getTaskCompletion(user.telegram_id, task.id), getRequestedChannelIds(user.telegram_id)])
      : [null, []];

    const deadline = resolveDeadline();
    const isLocked = task.type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE && !isSubscriptionComplete(requestedChannelIds);
    const state = computeTaskState(task, deadline, Boolean(completion), isLocked);

    return jsonOk({
      task: {
        ...serializeTaskSummary(task, deadline, state),
        ...subscriptionTaskFields(task.type, requestedChannelIds),
        conditions: task.conditions,
        options: task.options.map((option) => ({ id: option.id, text: option.text })),
        submission: completion ? serializeCompletion(completion) : null,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
