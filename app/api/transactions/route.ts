import type { NextRequest } from "next/server";

import { getTransactions } from "@/lib/db";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/transactions?page=1&limit=20 — история операций пользователя из PostgreSQL. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const parsed = paginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };

    const { items, total } = await getTransactions(user.telegram_id, limit, (page - 1) * limit);

    return jsonOk({
      transactions: items.map((transaction) => ({
        id: String(transaction.id),
        amount: Number(transaction.amount),
        type: transaction.type === "SPEND" ? "SPEND" : "EARN",
        description: transaction.description ?? "",
        createdAt: new Date(transaction.created_at).toISOString(),
      })),
      page,
      limit,
      hasMore: (page - 1) * limit + items.length < total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
