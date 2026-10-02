import { toPublicUser } from "@/lib/auth";
import { getProfileStats } from "@/lib/db";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/profile — профиль и статистика текущего пользователя из PostgreSQL. */
export async function GET() {
  try {
    const user = await requireUser();
    const { completedToday, rank, totalUsers } = await getProfileStats(user.telegram_id);

    return jsonOk({
      user: toPublicUser(user),
      stats: {
        completedTasks: Number(user.completed_tasks),
        completedToday,
        balance: Number(user.balance),
        totalEarned: Number(user.total_earned),
        rank,
        totalUsers,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
