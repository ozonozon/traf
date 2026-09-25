import { getTodayStats } from "@/lib/app-stats";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — статистика платформы.
 *
 * participantsCount и totalBonuses берутся из таблицы AppStats: они увеличиваются
 * один раз в календарный день на сервере, поэтому значения одинаковы для всех
 * пользователей и не меняются при обновлении страницы.
 */
export async function GET() {
  try {
    const activeWhere = { status: "ACTIVE" as const, deadline: { gte: new Date() } };

    const [dailyStats, rewardAggregate] = await Promise.all([
      getTodayStats(),
      prisma.task.aggregate({ where: activeWhere, _min: { reward: true } }),
    ]);

    return jsonOk({
      participantsCount: dailyStats.participantsCount,
      minimumReward: rewardAggregate._min.reward ?? 0,
      totalBonuses: dailyStats.totalBonuses,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
