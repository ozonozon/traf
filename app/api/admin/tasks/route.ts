import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { RouteError, handleRouteError, jsonOk, requireAdmin } from "@/lib/http";
import { formatZodIssues, adminTaskSchema, paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin API (заготовка под будущую админку).
 * Доступ по заголовку x-admin-token = ADMIN_TOKEN.
 *
 * GET  /api/admin/tasks?page=1&limit=20 — все задания (включая PAUSED) с вариантами.
 * POST /api/admin/tasks                 — создать задание вместе с вариантами ответов.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const skip = (page - 1) * limit;

    const [total, tasks] = await Promise.all([
      prisma.task.count(),
      prisma.task.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { options: { orderBy: { order: "asc" } }, _count: { select: { submissions: true } } },
      }),
    ]);

    return jsonOk({
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        conditions: task.conditions,
        virtualTarget: task.virtualTarget,
        type: task.type,
        icon: task.icon,
        reward: task.reward,
        minLength: task.minLength,
        deadline: task.deadline.toISOString(),
        status: task.status,
        requiresModeration: task.requiresModeration,
        requiresRating: task.requiresRating,
        options: task.options.map((option) => ({ id: option.id, text: option.text })),
        submissionsCount: task._count.submissions,
      })),
      page,
      limit,
      total,
      hasMore: skip + tasks.length < total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = adminTaskSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new RouteError("VALIDATION_ERROR", "Проверьте данные задания", 422, formatZodIssues(parsed.error));
    }

    const { options, ...taskData } = parsed.data;
    const task = await prisma.task.create({
      data: {
        ...taskData,
        options: {
          create: options.map((text, index) => ({ text, order: index })),
        },
      },
      include: { options: true },
    });

    return jsonOk({ task: { ...task, deadline: task.deadline.toISOString() } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
