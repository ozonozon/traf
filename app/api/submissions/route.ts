import type { NextRequest } from "next/server";

import { TELEGRAM_CHANNELS } from "@/config/telegram-channels";
import { toPublicUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RouteError, handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { TELEGRAM_SUBSCRIPTION_TASK_TYPE, serializeSubmission } from "@/lib/tasks";
import { checkChannelsMembership, hasUnconfiguredChannels, isNumericTelegramId } from "@/lib/telegram-channels";
import { formatZodIssues, submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/submissions
 *
 * Выполнение задания.
 *  - userId определяется только из подписанной сессии;
 *  - reward берётся только из Task в БД;
 *  - для заданий TELEGRAM_SUBSCRIPTION backend сам проверяет подписки через
 *    Telegram Bot API (getChatMember) — клиент не может «заявить» о подписке;
 *  - все изменения (submission + transaction + баланс) выполняются атомарно.
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
    let answer = parsed.data.answer.trim();

    const taskPreview = await prisma.task.findUnique({ where: { id: taskId }, select: { type: true } });
    if (!taskPreview) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }

    // --- Проверка Telegram-подписок (только backend) ---
    if (taskPreview.type === TELEGRAM_SUBSCRIPTION_TASK_TYPE) {
      if (hasUnconfiguredChannels()) {
        throw new RouteError("CHANNELS_NOT_CONFIGURED", "Каналы ещё не настроены.", 503);
      }
      if (!isNumericTelegramId(user.telegramId)) {
        throw new RouteError(
          "CHANNELS_CHECK_UNAVAILABLE",
          "Проверка подписок доступна только внутри Telegram.",
          409,
        );
      }

      const results = await checkChannelsMembership(user.telegramId, TELEGRAM_CHANNELS);
      const details = {
        channels: results.map((result) => ({
          id: result.channelId,
          status: result.status,
          message: result.message,
        })),
      };

      if (results.some((result) => result.status === "error")) {
        throw new RouteError(
          "CHANNELS_CHECK_FAILED",
          "Не удалось проверить подписки. Попробуйте позже.",
          502,
          undefined,
          details,
        );
      }

      const notJoined = results.filter((result) => result.status !== "joined");
      if (notJoined.length > 0) {
        throw new RouteError(
          "CHANNELS_NOT_SUBSCRIBED",
          `Подпишитесь на все ${TELEGRAM_CHANNELS.length} канала`,
          409,
          undefined,
          details,
        );
      }

      answer = `Подписка подтверждена: ${TELEGRAM_CHANNELS.map((channel) => channel.title).join(", ")}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: { options: { select: { id: true } } },
      });

      if (!task) {
        throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
      }
      if (task.status !== "ACTIVE") {
        throw new RouteError("TASK_NOT_ACTIVE", "Задание больше не доступно", 409);
      }
      if (task.deadline.getTime() < Date.now()) {
        throw new RouteError("TASK_EXPIRED", "Срок выполнения задания истёк", 409);
      }

      const isSubscriptionTask = task.type === TELEGRAM_SUBSCRIPTION_TASK_TYPE;

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

      const existing = await tx.taskSubmission.findUnique({
        where: { userId_taskId: { userId: user.id, taskId: task.id } },
      });
      if (existing) {
        throw new RouteError("TASK_ALREADY_COMPLETED", "Вы уже выполняли это задание", 409);
      }

      const reward = task.reward;

      const submission = await tx.taskSubmission.create({
        data: {
          userId: user.id,
          taskId: task.id,
          answer,
          rating: isSubscriptionTask ? null : (rating ?? null),
          selectedOptionId: isSubscriptionTask ? null : (selectedOptionId ?? null),
          reward,
          status: "APPROVED",
        },
      });

      await tx.virtualTransaction.create({
        data: {
          userId: user.id,
          amount: reward,
          type: "EARN",
          description: `Выполнение задания «${task.title}»`,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: reward },
          totalEarned: { increment: reward },
          completedTasks: { increment: 1 },
        },
      });

      return { submission, updatedUser, reward };
    });

    return jsonOk(
      {
        submission: serializeSubmission(result.submission),
        user: toPublicUser(result.updatedUser),
        reward: result.reward,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
