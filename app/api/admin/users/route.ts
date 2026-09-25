import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk, requireAdmin } from "@/lib/http";
import { paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/users?page=1&limit=20 — пользователи с виртуальной статистикой. */
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

    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: [{ totalEarned: "desc" }, { createdAt: "asc" }],
        skip,
        take: limit,
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          balance: true,
          totalEarned: true,
          completedTasks: true,
          isDemo: true,
          createdAt: true,
        },
      }),
    ]);

    return jsonOk({
      users: users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })),
      page,
      limit,
      total,
      hasMore: skip + users.length < total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
