import { toPublicUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { startOfToday } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/profile — профиль и виртуальная статистика текущего пользователя. */
export async function GET() {
  try {
    const user = await requireUser();

    const [completedToday, betterEarnedCount, totalUsers] = await Promise.all([
      prisma.taskSubmission.count({
        where: { userId: user.id, status: "APPROVED", createdAt: { gte: startOfToday() } },
      }),
      prisma.user.count({ where: { totalEarned: { gt: user.totalEarned } } }),
      prisma.user.count(),
    ]);

    return jsonOk({
      user: toPublicUser(user),
      stats: {
        completedTasks: user.completedTasks,
        completedToday,
        balance: user.balance,
        totalEarned: user.totalEarned,
        rank: betterEarnedCount + 1,
        totalUsers,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
