import "server-only";

/**
 * Доступ к серверным переменным окружения в одном месте.
 *
 * Здесь только секреты/серверная конфигурация: они НИКОГДА не попадают в клиентский
 * бандл (модуль помечен `server-only`, ни одна переменная не объявлена как `NEXT_PUBLIC_*`).
 *
 * Для MVP достаточно трёх переменных:
 *   TELEGRAM_BOT_TOKEN  — токен бота из @BotFather (проверка initData, подписки, /start);
 *   AUTH_SECRET         — подпись httpOnly-cookie с состоянием пользователя;
 *   NEXT_PUBLIC_APP_URL — публичный HTTPS-адрес Mini App (кнопка «Открыть» в боте).
 *
 * DATABASE_URL проекту не нужен: внешней БД нет (см. lib/store.ts, lib/demo-data.ts).
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

/**
 * Публичный адрес Mini App без завершающего «/» или пустая строка, если он не задан.
 *
 * Переменная публичная (NEXT_PUBLIC_APP_URL) — это не секрет: адрес приложения и так
 * известен Telegram. Читается она только из server-side кода (lib/telegram-bot.ts).
 */
export function getMiniAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  return raw ? raw.replace(/\/+$/, "") : "";
}

/** Секрет для подписи cookie: в dev допускается фолбэк, в production задаётся явно. */
export function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() || getTelegramBotToken() || "voxy-local-development-secret";
}


