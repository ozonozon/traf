import { toPublicUser } from "@/lib/auth";
import { startOfToday } from "@/lib/dates";
import { getLeaderboardBots } from "@/lib/demo-data";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/profile — профиль и виртуальная статистика текущего пользователя. */
export async function GET() {
  try {
    const user = await requireUser();

    const completedToday = user.submissions.filter(
      (submission) => new Date(submission.createdAt).getTime() >= startOfToday().getTime(),
    ).length;

    // Позиция считается по демонстрационному рейтингу (lib/demo-data.ts).
    const bots = getLeaderboardBots();
    const betterEarned = bots.filter((bot) => bot.totalEarned > user.totalEarned).length;

    return jsonOk({
      user: toPublicUser(user),
      stats: {
        completedTasks: user.completedTasks,
        completedToday,
        balance: user.balance,
        totalEarned: user.totalEarned,
        rank: betterEarned + 1,
        totalUsers: bots.length + 1,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

