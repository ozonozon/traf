import { getCurrentUser } from "@/lib/auth";
import { listDemoTasks, resolveDeadline } from "@/lib/demo-data";
import { handleRouteError, jsonOk } from "@/lib/http";
import { hasCompleted } from "@/lib/store";
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
 * Тренировочные задания и прогресс текущего пользователя.
 * Задания заданы в коде (lib/demo-data.ts), внешняя БД не используется.
 * Дедлайн — «до 23:59» текущего дня, чтобы демо-задания всегда были доступны.
 *
 * Задание «Подписка на Telegram-каналы» обязательное: пока Telegram не прислал заявки
 * по всем трём каналам, остальные задания отдаются со статусом locked.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const deadline = resolveDeadline();
    const subscriptionDone = isSubscriptionComplete(user);

    const items = listDemoTasks().map((task) => {
      const isCompleted = Boolean(user && hasCompleted(user, task.id));
      const isLocked = task.type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE && !subscriptionDone;

      return {
        ...serializeTaskSummary(task, deadline, computeTaskState(task, deadline, isCompleted, isLocked)),
        ...subscriptionTaskFields(task.type, user),
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

