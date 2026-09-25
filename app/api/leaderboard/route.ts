import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { LEADERBOARD_TOP_LIMIT, ensureDailyLeaderboardUpdate } from "@/lib/leaderboard-daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard
 *
 * Перед выдачей списка один раз в сутки выполняется daily update
 * (см. lib/leaderboard-daily.ts): часть участников получает прибавку,
 * добавляются новые demo-участники. Повторные вызовы в тот же день ничего не меняют.
 *
 * Ответ: ТОП-30 по totalEarned DESC + отдельный блок текущего пользователя,
 * который не обязан входить в ТОП-30.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    // Идемпотентно: уникальная дата в LeaderboardDailyUpdate защищает от повторных запусков.
    await ensureDailyLeaderboardUpdate();

    const [total, top] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: [{ totalEarned: "desc" }, { createdAt: "asc" }],
        take: LEADERBOARD_TOP_LIMIT,
      }),
    ]);

    const entries = top.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      totalEarned: user.totalEarned,
      completedTasks: user.completedTasks,
      isCurrentUser: currentUser?.id === user.id,
    }));

    let currentUserEntry = null;
    if (currentUser) {
      const betterEarnedCount = await prisma.user.count({
        where: { totalEarned: { gt: currentUser.totalEarned } },
      });
      const rank = betterEarnedCount + 1;
      currentUserEntry = {
        rank,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        photoUrl: currentUser.photoUrl,
        totalEarned: currentUser.totalEarned,
        completedTasks: currentUser.completedTasks,
        isInTop: rank <= LEADERBOARD_TOP_LIMIT,
      };
    }

    return jsonOk({
      entries,
      total,
      topLimit: LEADERBOARD_TOP_LIMIT,
      currentUser: currentUserEntry,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
