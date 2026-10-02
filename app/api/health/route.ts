import { query } from "@/lib/db";
import { getTelegramBotToken } from "@/lib/env";
import { jsonOk } from "@/lib/http";

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
export async function GET() {
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

  return jsonOk({
    ok: database.schema,
    database,
    config,
  });
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
