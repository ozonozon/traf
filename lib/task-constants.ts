/**
 * Константы типов заданий.
 *
 * Отдельный «плоский» модуль: константу использует и серверный слой,
 * и клиентский экран задания (поэтому здесь нет ни Prisma, ни `server-only`).
 */

/** Задание, для которого backend проверяет подписки через Telegram Bot API. */
export const TELEGRAM_SUBSCRIPTION_TASK_TYPE = "TELEGRAM_SUBSCRIPTION";

/** Задание-симуляция отзыва (основной текстовый тип). */
export const REVIEW_SIMULATION_TASK_TYPE = "REVIEW_SIMULATION";
