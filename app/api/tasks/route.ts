import { getCurrentUser } from "@/lib/auth";
import { getCompletedTaskIds, getRequestedChannelIds } from "@/lib/db";
import { listDemoTasks, resolveDeadline } from "@/lib/demo-data";
import { handleRouteError, jsonOk } from "@/lib/http";
import {
  TELEGRAM_SUBSCRIPTION_TASK_TYPE,
  computeTaskState,
  isSubscriptionComplete,
  serializeTaskSummary,
  subscriptionTaskFields,
} from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks
 *
 * Задания и прогресс текущего пользователя. Все пользовательские данные — из PostgreSQL.
 * Задание «Подписка на Telegram-каналы» обязательное: пока в channel_requests нет заявок
 * по всем трём каналам, остальные задания отдаются со статусом locked.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    const [completedIds, requestedChannelIds] = user
      ? await Promise.all([getCompletedTaskIds(user.telegram_id), getRequestedChannelIds(user.telegram_id)])
      : [[], []];

    const deadline = resolveDeadline();
    const subscriptionDone = isSubscriptionComplete(requestedChannelIds);

    const items = listDemoTasks().map((task) => {
      const isCompleted = completedIds.includes(task.id);
      const isLocked = task.type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE && !subscriptionDone;

      return {
        ...serializeTaskSummary(task, deadline, computeTaskState(task, deadline, isCompleted, isLocked)),
        ...subscriptionTaskFields(task.type, requestedChannelIds),
      };
    });
    const total = items.length;
    const completed = items.filter((item) => item.state === "completed").length;

    return jsonOk({
      tasks: items,
      progress: { completed, total, remaining: total - completed },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
