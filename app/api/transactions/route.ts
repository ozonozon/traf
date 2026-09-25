import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { paginationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/transactions?page=1&limit=20 — история виртуальных операций. */
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

    const [total, transactions] = await Promise.all([
      prisma.virtualTransaction.count({ where: { userId: user.id } }),
      prisma.virtualTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return jsonOk({
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
      })),
      page,
      limit,
      hasMore: skip + transactions.length < total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
