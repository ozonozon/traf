import { getPlatformStats } from "@/lib/db";
import { minimumReward } from "@/lib/demo-data";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — статистика платформы по реальным данным PostgreSQL:
 * число участников (users) и сумма выплаченных виртуальных бонусов (total_earned).
 */
export async function GET() {
  try {
    const { participants, totalBonuses } = await getPlatformStats();

    return jsonOk({
      participantsCount: participants,
      minimumReward: minimumReward(),
      totalBonuses,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
