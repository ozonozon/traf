import "server-only";

/**
 * Доступ к серверным переменным окружения в одном месте.
 *
 * Здесь только секреты/серверная конфигурация: они НИКОГДА не попадают в клиентский
 * бандл (модуль помечен `server-only`, ни одна переменная не объявлена как `NEXT_PUBLIC_*`).
 *
 * Обязательные переменные:
 *   DATABASE_URL        — строка подключения (см. lib/prisma.ts и README);
 *   TELEGRAM_BOT_TOKEN  — токен бота из @BotFather, только сервер;
 *   AUTH_SECRET         — подпись httpOnly-сессии;
 *   ADMIN_TOKEN         — доступ к заготовке админ-API (необязательно; без него API отключён).
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function hasTelegramBotToken(): boolean {
  return getTelegramBotToken().length > 0;
}

/** Секрет для подписи сессии: в dev допускается фолбэк, в production задаётся явно. */
export function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() || getTelegramBotToken() || "voxy-local-development-secret";
}

export function hasAuthSecret(): boolean {
  return (process.env.AUTH_SECRET?.trim() ?? "").length > 0;
}

/** Токен админ-API или null (тогда админ-роуты отвечают 503 и ничего не отдают). */
export function getAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token ? token : null;
}
