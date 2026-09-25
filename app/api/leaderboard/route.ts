import { getCurrentUser } from "@/lib/auth";
import { getLeaderboardBots } from "@/lib/demo-data";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Размер ТОП-списка. */
const LEADERBOARD_TOP_LIMIT = 30;

interface LeaderboardRow {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  totalEarned: number;
  completedTasks: number;
  isCurrentUser: boolean;
}

/**
 * GET /api/leaderboard
 *
 * Демонстрационные участники формируются детерминированно из текущей даты
 * (см. lib/demo-data.ts): значения одинаковы для всех пользователей и не меняются
 * в течение дня, а каждый следующий день часть участников получает прибавку.
 * Повторные запросы ничего не «накручивают»: список пересчитывается, а не хранится.
 *
 * Ответ: ТОП-30 по totalEarned DESC + отдельный блок текущего пользователя,
 * который не обязан входить в ТОП-30.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    const rows: LeaderboardRow[] = getLeaderboardBots().map((bot) => ({
      id: bot.id,
      firstName: bot.firstName,
      lastName: bot.lastName,
      username: bot.username,
      photoUrl: null,
      totalEarned: bot.totalEarned,
      completedTasks: bot.completedTasks,
      isCurrentUser: false,
    }));

    if (currentUser) {
      rows.push({
        id: `self-${currentUser.telegramId}`,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        photoUrl: currentUser.photoUrl,
        totalEarned: currentUser.totalEarned,
        completedTasks: currentUser.completedTasks,
        isCurrentUser: true,
      });
    }

    // По убыванию заработка; при равенстве демо-участники выше реального пользователя
    // (как раньше: демо-профили создавались раньше и сортировались по createdAt asc).
    rows.sort(
      (left, right) =>
        right.totalEarned - left.totalEarned || Number(left.isCurrentUser) - Number(right.isCurrentUser),
    );

    const entries = rows.slice(0, LEADERBOARD_TOP_LIMIT).map((row, index) => ({ rank: index + 1, ...row }));
    const selfIndex = rows.findIndex((row) => row.isCurrentUser);

    const currentUserEntry =
      currentUser && selfIndex >= 0
        ? {
            rank: selfIndex + 1,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            username: currentUser.username,
            photoUrl: currentUser.photoUrl,
            totalEarned: currentUser.totalEarned,
            completedTasks: currentUser.completedTasks,
            isInTop: selfIndex + 1 <= LEADERBOARD_TOP_LIMIT,
          }
        : null;

    return jsonOk({
      entries,
      total: rows.length,
      topLimit: LEADERBOARD_TOP_LIMIT,
      currentUser: currentUserEntry,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

