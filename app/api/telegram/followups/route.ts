import { timingSafeEqual } from "node:crypto";

import { isProduction } from "@/lib/env";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { drainFollowupMessages } from "@/lib/telegram-followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/telegram/followups — воркер цепочки добивающих сообщений после /start.
 *
 * Вызывает Vercel Cron (см. vercel.json) или любой внешний планировщик; webhook дергает
 * тот же воркер на каждом апдейте. Логика отправки и идемпотентность — в
 * lib/telegram-followups.ts (каждое сообщение помечается в БД, дублей быть не может).
 *
 * Защита: заголовок `Authorization: Bearer <CRON_SECRET>` — ровно то, что Vercel Cron
 * подставляет автоматически, если переменная CRON_SECRET задана в проекте.
 * В production без CRON_SECRET эндпоинт отвечает 503 (защита от спама через открытый URL),
 * в development можно вызывать без секрета для локальных проверок.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim() ?? "";

  if (!secret) {
    if (isProduction()) {
      return jsonError("CRON_SECRET_MISSING", "CRON_SECRET не настроен на сервере", 503);
    }
  } else if (!isValidCronRequest(request, secret)) {
    return jsonError("UNAUTHORIZED", "Неверный CRON_SECRET", 401);
  }

  try {
    const result = await drainFollowupMessages();
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Сравнение секрета без утечки времени выполнения. */
function isValidCronRequest(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const GET = handle;
export const POST = handle;
