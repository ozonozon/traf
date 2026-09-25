import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { computeTaskState, serializeTaskSummary, subscriptionTaskFields } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks
 * Доступные (ACTIVE) и завершённые по дедлайну задания. PAUSED не показывается.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    const tasks = await prisma.task.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: [{ reward: "asc" }, { createdAt: "asc" }],
    });

    let completedIds = new Set<string>();
    if (user) {
      const submissions = await prisma.taskSubmission.findMany({
        where: { userId: user.id, status: "APPROVED" },
        select: { taskId: true },
      });
      completedIds = new Set(submissions.map((submission) => submission.taskId));
    }

    const items = tasks.map((task) => ({
      ...serializeTaskSummary(task, computeTaskState(task, completedIds.has(task.id))),
      ...subscriptionTaskFields(task.type),
    }));
    const total = items.length;
    const completed = items.filter((item) => item.state === "completed").length;

    return jsonOk({
      tasks: items,
      progress: { completed, total, remaining: total - completed },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
