import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { RouteError, handleRouteError, jsonOk, requireAdmin } from "@/lib/http";
import { adminTaskUpdateSchema, formatZodIssues } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/admin/tasks/[id] — частичное обновление задания (и вариантов ответа). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = adminTaskUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new RouteError("VALIDATION_ERROR", "Проверьте данные задания", 422, formatZodIssues(parsed.error));
    }

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }

    const { options, ...taskData } = parsed.data;

    const task = await prisma.$transaction(async (tx) => {
      if (options) {
        await tx.taskOption.deleteMany({ where: { taskId: id } });
        await tx.taskOption.createMany({ data: options.map((text, index) => ({ taskId: id, text, order: index })) });
      }
      return tx.task.update({
        where: { id },
        data: taskData,
        include: { options: { orderBy: { order: "asc" } } },
      });
    });

    return jsonOk({ task: { ...task, deadline: task.deadline.toISOString() } });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** DELETE /api/admin/tasks/[id] — удаление задания (каскадно: варианты и submissions). */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new RouteError("TASK_NOT_FOUND", "Задание не найдено", 404);
    }

    await prisma.task.delete({ where: { id } });
    return jsonOk({ deleted: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
