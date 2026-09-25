/**
 * Даты приложения. Отдельный «плоский» модуль без серверных зависимостей:
 * его используют и серверный слой, и CLI-скрипт `prisma/seed.ts`.
 */

/** Начало текущих суток (локальная полночь) — база для «сегодня». */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
