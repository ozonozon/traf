/**
 * Стартовые значения публичной статистики приложения.
 *
 * «Плоский» модуль (без Prisma), поэтому значения используют и серверный
 * сервис `lib/app-stats.ts`, и CLI-скрипт `prisma/seed.ts`.
 */

/** Стартовые значения при самом первом запуске. */
export const INITIAL_PARTICIPANTS = 2344;
export const INITIAL_TOTAL_BONUSES = 2_235_890;

/** Дневные приросты (случайное целое в диапазоне, считается на сервере). */
export const PARTICIPANTS_STEP = { min: 20, max: 50 } as const;
export const BONUS_STEP = { min: 15_000, max: 25_000 } as const;
