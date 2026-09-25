import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk, requireAdmin } from "@/lib/http";
import { paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/submissions?page=1&limit=20 — выполненные задания с пользователями. */
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

    const [total, submissions] = await Promise.all([
      prisma.taskSubmission.count(),
      prisma.taskSubmission.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
          task: { select: { id: true, title: true, reward: true } },
        },
      }),
    ]);

    return jsonOk({
      submissions: submissions.map((submission) => ({
        id: submission.id,
        answer: submission.answer,
        rating: submission.rating,
        reward: submission.reward,
        status: submission.status,
        createdAt: submission.createdAt.toISOString(),
        user: submission.user,
        task: submission.task,
      })),
      page,
      limit,
      total,
      hasMore: skip + submissions.length < total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
