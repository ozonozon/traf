import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { getUserFromInitData, toPublicUser } from "@/lib/auth";
import { getRequestedChannelIds, query } from "@/lib/db";
import { getTelegramBotToken } from "@/lib/env";
import { jsonOk } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Яркая диагностика production-окружения без секретов.
 *
 * Показывает, настроены ли переменные и отвечает ли база:
 *   GET /api/health
 *
 * — database.configured/reachable/schema и короткая причина ошибки (код PostgreSQL,
 *   без строки подключения, хоста и пароля);
 * — какие серверные переменные присутствуют (только true/false).
 *
 * Побочный эффект: обращение к базе запускает ensureSchema() из lib/db.ts,
 * то есть на «чистой» базе таблицы создадутся, и повторный вызов вернёт schema: true.
 */
export async function GET(request: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();

  const config = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    telegramBotToken: Boolean(getTelegramBotToken()),
    authSecret: Boolean(process.env.AUTH_SECRET?.trim()),
    appUrl: Boolean(appUrl),
    appUrlHttps: appUrl.startsWith("https://"),
  };

  let database: { configured: boolean; reachable: boolean; schema: boolean; error: string | null } = {
    configured: config.databaseUrl,
    reachable: false,
    schema: false,
    error: null,
  };

  try {
    await query("SELECT COUNT(*)::text AS users FROM users");
    database = { configured: true, reachable: true, schema: true, error: null };
  } catch (error) {
    database = { ...database, error: describeDatabaseError(error) };
  }

  const payload: Record<string, unknown> = {
    ok: database.schema,
    database,
    config,
  };

  // ?auth=1 — чем авторизован именно этот запрос. Нужно, чтобы проверить Mini App
  // изнутри Telegram (открыть этот URL в WebView и увидеть cookie/заголовок/telegram_id).
  if (request.nextUrl.searchParams.get("auth") === "1") {
    payload.auth = await describeRequestAuth();
  }

  return jsonOk(payload);
}

/**
 * Как авторизован текущий запрос: есть ли session cookie, есть ли initData,
 * какой telegram_id получился и сколько у него заявок. Без секретов — только
 * данные самого вызывающего.
 */
async function describeRequestAuth() {
  const requestHeaders = await headers();
  const initDataHeader = requestHeaders.get(TELEGRAM_INIT_DATA_HEADER);
  const hasCookie = Boolean(requestHeaders.get("cookie")?.includes(`${SESSION_COOKIE}=`));

  const user = await getUserFromInitData(initDataHeader);

  if (!user) {
    return {
      initDataHeader: initDataHeader ? "present-but-invalid" : "absent",
      cookie: hasCookie ? "present" : "absent",
      telegramId: null,
      userInDb: false,
      channelRequests: 0,
      requestedChannelIds: [] as string[],
      note: "запрос без валидного Telegram initData и без подходящей cookie",
    };
  }

  const requestedChannelIds = await getRequestedChannelIds(user.telegram_id);

  return {
    initDataHeader: "valid",
    cookie: hasCookie ? "present" : "absent",
    telegramId: user.telegram_id,
    userInDb: true,
    user: toPublicUser(user),
    channelRequests: requestedChannelIds.length,
    requestedChannelIds,
  };
}

/** Короткая причина сбоя базы: только код PostgreSQL, без деталей подключения. */
function describeDatabaseError(error: unknown): string {
  const raw = error as { code?: unknown } | null;
  const code = typeof raw?.code === "string" ? raw.code : null;

  if (!code) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) return "DATABASE_URL_MISSING";
    return "UNKNOWN";
  }

  const known: Record<string, string> = {
    "42P01": "SCHEMA_MISSING",
    "28P01": "AUTH_FAILED",
    "28000": "AUTH_FAILED",
    "3D000": "DATABASE_MISSING",
    ETIMEDOUT: "CONNECTION_TIMEOUT",
    ECONNREFUSED: "CONNECTION_REFUSED",
    ENOTFOUND: "HOST_NOT_FOUND",
  };

  return known[code] ?? `PG_${code}`;
}
