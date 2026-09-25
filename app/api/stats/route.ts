import { getDailyAppStats, minimumReward } from "@/lib/demo-data";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — демонстрационная статистика платформы.
 *
 * Значения выводятся детерминированно из текущей даты (см. lib/demo-data.ts):
 * в день запуска MVP это стартовые 2344 участника и 2 235 890 бонусов, дальше
 * каждый день прибавляется 20–50 участников и 15 000–25 000 бонусов.
 * Поэтому числа одинаковы для всех пользователей и не меняются при обновлении страницы.
 */
export async function GET() {
  try {
    const stats = getDailyAppStats();

    return jsonOk({
      participantsCount: stats.participantsCount,
      minimumReward: minimumReward(),
      totalBonuses: stats.totalBonuses,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

