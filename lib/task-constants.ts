/**
 * Константы типов заданий.
 *
 * Отдельный «плоский» модуль: константу использует и серверный слой,
 * и клиентский экран задания (поэтому модуль не помечен `server-only`).
 */

/**
 * Задание, для которого backend проверяет подписки через Telegram Bot API.
 * @deprecated Подписки не проверяются: используется только как идентификатор типа задания.
 */
export const TELEGRAM_SUBSCRIPTION_TASK_TYPE = "TELEGRAM_SUBSCRIPTION";

/** id обязательного задания «Подписка на Telegram-каналы». */
export const TELEGRAM_SUBSCRIPTION_TASK_ID = "task-telegram-subscription";

