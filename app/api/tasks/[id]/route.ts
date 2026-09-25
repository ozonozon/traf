import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RouteError, handleRouteError, jsonOk } from "@/lib/http";
import { computeTaskState, serializeSubmission, serializeTaskSummary, subscriptionTaskFields } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tasks/[id] — задание, его варианты ответов и submission текущего пользователя. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    const task = await prisma.task.findUnique({
      where: { id },
      include: { options: { orderBy: { order: "asc" } } },
    });

    if (!task) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }
    if (task.status === "PAUSED") {
      throw new RouteError("TASK_NOT_ACTIVE", "Задание больше не доступно", 404);
    }

    const submission = user
      ? await prisma.taskSubmission.findUnique({
          where: { userId_taskId: { userId: user.id, taskId: task.id } },
        })
      : null;

    const state = computeTaskState(task, Boolean(submission));

    return jsonOk({
      task: {
        ...serializeTaskSummary(task, state),
        ...subscriptionTaskFields(task.type),
        conditions: task.conditions,
        options: task.options.map((option) => ({ id: option.id, text: option.text })),
        submission: submission ? serializeSubmission(submission) : null,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
