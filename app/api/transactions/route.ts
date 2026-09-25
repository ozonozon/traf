import type { NextRequest } from "next/server";

import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { toTransactionDto } from "@/lib/store";
import { paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/transactions?page=1&limit=20 — история виртуальных операций.
 *
 * Операции хранятся в подписанной cookie пользователя (новые — первыми),
 * поэтому пагинация выполняется по этому списку.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const parsed = paginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const skip = (page - 1) * limit;

    const all = user.transactions;
    const items = all.slice(skip, skip + limit);

    return jsonOk({
      transactions: items.map(toTransactionDto),
      page,
      limit,
      hasMore: skip + items.length < all.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

