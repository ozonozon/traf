/**
 * Константы типов заданий.
 *
 * Отдельный «плоский» модуль: константу использует и серверный слой,
 * и клиентский экран задания (поэтому модуль не помечен `server-only`).
 */

/** Задание, для которого backend проверяет подписки через Telegram Bot API. */
export const TELEGRAM_SUBSCRIPTION_TASK_TYPE = "TELEGRAM_SUBSCRIPTION";

