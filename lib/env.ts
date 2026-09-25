import "server-only";

/**
 * Доступ к серверным переменным окружения в одном месте.
 *
 * Здесь только секреты/серверная конфигурация: они НИКОГДА не попадают в клиентский
 * бандл (модуль помечен `server-only`, ни одна переменная не объявлена как `NEXT_PUBLIC_*`).
 *
 * Для MVP достаточно двух переменных:
 *   TELEGRAM_BOT_TOKEN  — токен бота из @BotFather (проверка initData, проверка подписок);
 *   AUTH_SECRET         — подпись httpOnly-cookie с состоянием пользователя.
 *
 * DATABASE_URL проекту не нужен: внешней БД нет (см. lib/store.ts, lib/demo-data.ts).
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


