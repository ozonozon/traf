import "server-only";

/**
 * Доступ к серверным переменным окружения в одном месте.
 *
 * Здесь только секреты/серверная конфигурация: они НИКОГДА не попадают в клиентский
 * бандл (модуль помечен `server-only`, ни одна переменная не объявлена как `NEXT_PUBLIC_*`).
 *
 * Для MVP достаточно четырёх переменных:
 *   DATABASE_URL        — строка подключения к PostgreSQL (читается только в lib/db.ts);
 *   TELEGRAM_BOT_TOKEN  — токен бота из @BotFather (проверка initData, ответ на /start);
 *   AUTH_SECRET         — подпись httpOnly-сессии с telegram id;
 *   NEXT_PUBLIC_APP_URL — публичный HTTPS-адрес Mini App (кнопка «Открыть» в боте).
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

/** Секрет для подписи cookie: в dev допускается фолбэк, в production задаётся явно. */
export function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() || getTelegramBotToken() || "voxy-local-development-secret";
}


