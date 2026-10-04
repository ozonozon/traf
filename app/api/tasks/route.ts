import { checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { getCompletedTaskIds } from "@/lib/db";
import { listDemoTasks, resolveDeadline } from "@/lib/demo-data";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import {
  TELEGRAM_SUBSCRIPTION_TASK_TYPE,
  computeTaskState,
  isSubscriptionTaskDone,
  publicSubscriptionChannels,
  serializeTaskSummary,
  subscriptionTaskFields,
} from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks
 *
 * Задания и прогресс ТЕКУЩЕГО пользователя. Авторизация — та же, что у /api/profile
 * (`requireUser()`: заголовок X-Telegram-Init-Data, затем подписанная cookie), поэтому
 * выполненные задания всегда берутся из PostgreSQL (task_completions) по telegram_id
 * из сессии. Анонимного ответа «всё сброшено» больше нет: без авторизации — 401,
 * клиент получает ошибку и повторяет вход, а не показывает ложное пустое состояние.
 *
 * Обязательное задание «Подписка на Telegram-каналы»: статусы каналов приходят из
 * серверной проверки Telegram Bot API (`getChatMember`), а остальные задания закрыты,
 * пока за обязательное задание не получена награда (server-side проверка всех подписок).
 * Проверка подписки выполняется только для незавершённого обязательного задания.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const completedIds = await getCompletedTaskIds(user.telegram_id);
    const subscriptionDone = isSubscriptionTaskDone(completedIds);

    const deadline = resolveDeadline();

    // Живая проверка подписок нужна только пока обязательное задание не выполнено.
    const subscriptionCheck = !subscriptionDone
      ? await checkChannelSubscriptions(user.telegram_id).catch(() => null)
      : null;
    const subscriptionChannels = subscriptionCheck?.channels ?? publicSubscriptionChannels();

    const items = listDemoTasks().map((task) => {
      const isCompleted = completedIds.includes(task.id);
      const isLocked = task.type !== TELEGRAM_SUBSCRIPTION_TASK_TYPE && !subscriptionDone;

      return {
        ...serializeTaskSummary(task, deadline, computeTaskState(task, deadline, isCompleted, isLocked)),
        ...subscriptionTaskFields(task.type, subscriptionChannels),
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
