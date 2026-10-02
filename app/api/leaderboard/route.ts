import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard, getUserRank } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Размер ТОП-списка. */
const LEADERBOARD_TOP_LIMIT = 30;

/**
 * GET /api/leaderboard
 *
 * Рейтинг считается по таблице users (ORDER BY total_earned DESC) — реальные данные
 * из PostgreSQL. Демо-заполнение интерфейса лежит в той же таблице с флагом is_demo
 * и не подмешивается ниоткуда больше. Текущий пользователь определяется по telegram_id
 * из сессии и дополнительно показывается отдельным блоком.
 */
export async function GET() {
  try {
    const [currentUser, board] = await Promise.all([getCurrentUser(), getLeaderboard(LEADERBOARD_TOP_LIMIT)]);

    const entries = board.entries.map((row, index) => ({
      rank: index + 1,
      id: `tg-${row.telegram_id}`,
      firstName: row.first_name ?? "Пользователь",
      lastName: row.last_name,
      username: row.username,
      photoUrl: row.photo_url,
      totalEarned: Number(row.total_earned),
      completedTasks: Number(row.completed_tasks),
      isCurrentUser: currentUser?.telegram_id === row.telegram_id,
    }));

    const currentUserEntry = currentUser
      ? await (async () => {
          const { rank } = await getUserRank(currentUser.telegram_id);
          return {
            rank,
            firstName: currentUser.first_name ?? "Пользователь",
            lastName: currentUser.last_name,
            username: currentUser.username,
            photoUrl: currentUser.photo_url,
            totalEarned: Number(currentUser.total_earned),
            completedTasks: Number(currentUser.completed_tasks),
            isInTop: rank <= LEADERBOARD_TOP_LIMIT,
          };
        })()
      : null;

    return jsonOk({
      entries,
      total: board.total,
      topLimit: LEADERBOARD_TOP_LIMIT,
      currentUser: currentUserEntry,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
