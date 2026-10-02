import type { NextRequest } from "next/server";

import { toPublicUser } from "@/lib/auth";
import { completeTask, getRequestedChannelIds, getTaskCompletion, type UserRow } from "@/lib/db";
import { findDemoTask, resolveDeadline } from "@/lib/demo-data";
import { RouteError, handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { TELEGRAM_SUBSCRIPTION_TASK_TYPE, isSubscriptionComplete, serializeCompletion } from "@/lib/tasks";
import { formatZodIssues, submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/submissions — выполнение задания.
 *
 * Пользователь определяется только из подписанной сессии, награда — только из описания
 * задания. Проверки: задание активно, дедлайн не прошёл, поля валидны, заявки на каналы
 * (для обязательного задания) получены Telegram, остальные задания разблокированы.
 * Начисление выполняется одной транзакцией PostgreSQL: task_completions + transactions
 * + balance/total_earned/completed_tasks. Повторно начислить задание нельзя.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = submissionSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new RouteError("VALIDATION_ERROR", "Проверьте заполненные поля", 422, formatZodIssues(parsed.error));
    }

    const { taskId, rating, selectedOptionId } = parsed.data;
    const answer = parsed.data.answer.trim();

    const task = findDemoTask(taskId);
    if (!task) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }

    if (task.status !== "ACTIVE") {
      throw new RouteError("TASK_NOT_ACTIVE", "Задание больше не доступно", 409);
    }
    if (resolveDeadline().getTime() < Date.now()) {
      throw new RouteError("TASK_EXPIRED", "Срок выполнения задания истёк", 409);
    }

    const isSubscriptionTask = task.type === TELEGRAM_SUBSCRIPTION_TASK_TYPE;
    const requestedChannelIds = await getRequestedChannelIds(user.telegram_id);
    const subscriptionDone = isSubscriptionComplete(requestedChannelIds);

    // Обязательное задание: заявки должны прийти от Telegram (не от нажатия кнопки).
    if (isSubscriptionTask && !subscriptionDone) {
      throw new RouteError(
        "JOIN_REQUESTS_INCOMPLETE",
        "Ожидаем подтверждение заявок от Telegram по всем каналам",
        409,
      );
    }

    // Следующие задания закрыты, пока обязательное задание не выполнено.
    if (!isSubscriptionTask && !subscriptionDone) {
      throw new RouteError(
        "TASKS_LOCKED",
        "Сначала выполните обязательное задание «Подписка на Telegram-каналы»",
        403,
      );
    }

    if (!isSubscriptionTask) {
      if (answer.length < task.minLength) {
        throw new RouteError("TEXT_TOO_SHORT", `Ответ должен быть не короче ${task.minLength} символов`, 422);
      }
      if (task.requiresRating && !rating) {
        throw new RouteError("RATING_REQUIRED", "Выберите оценку", 422);
      }
      if (selectedOptionId && !task.options.some((option) => option.id === selectedOptionId)) {
        throw new RouteError("INVALID_OPTION", "Некорректный вариант ответа", 422);
      }
    }

    const existing = await getTaskCompletion(user.telegram_id, task.id);
    if (existing) {
      throw new RouteError("TASK_ALREADY_COMPLETED", "Вы уже выполняли это задание", 409);
    }

    const result = await completeTask({
      telegramId: user.telegram_id,
      taskId: task.id,
      reward: task.reward,
      description: `Выполнение задания «${task.title}»`,
    });

    if (!result.created || !result.user) {
      throw new RouteError("TASK_ALREADY_COMPLETED", "Вы уже выполняли это задание", 409);
    }

    return jsonOk(
      {
        submission: serializeCompletion({ reward: task.reward, completed_at: new Date() }),
        user: toPublicUser(result.user as UserRow),
        reward: task.reward,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
