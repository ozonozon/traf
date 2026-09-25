import "server-only";

import crypto from "node:crypto";

import { BONUS_STEP, INITIAL_PARTICIPANTS, INITIAL_TOTAL_BONUSES, PARTICIPANTS_STEP } from "./app-stats-defaults";
import { startOfToday } from "./dates";
import { prisma } from "./db";

/**
 * Ежедневная статистика приложения.
 *
 * Значения увеличиваются ОДИН РАЗ В КАЛЕНДАРНЫЙ ДЕНЬ на сервере и сохраняются в БД
 * (таблица AppStats), поэтому:
 *  - обновление страницы, повторные запросы, ререндер и открытие Mini App
 *    не меняют числа;
 *  - все пользователи видят одинаковую статистику.
 *
 * Случайные приросты считаются через crypto.randomInt (не Math.random) и
 * фиксируются в БД, а не в localStorage/памяти процесса.
 */

export interface DailyAppStats {
  date: Date;
  participantsCount: number;
  totalBonuses: number;
}

/** Случайное целое в диапазоне [min, max] включительно. */
function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Статистика на текущий день.
 * Если записи на сегодня нет — создаёт её на основе последней записи (или стартовых
 * значений при самом первом запуске) и возвращает.
 */
export async function getTodayStats(): Promise<DailyAppStats> {
  const today = startOfToday();

  const existing = await prisma.appStats.findUnique({ where: { date: today } });
  if (existing) {
    return { date: existing.date, participantsCount: existing.participantsCount, totalBonuses: existing.totalBonuses };
  }

  // База для прироста — последняя сохранённая запись (предыдущий день).
  const previous = await prisma.appStats.findFirst({ orderBy: { date: "desc" } });

  // Самый первый запуск: ровно стартовые значения, без прироста.
  const next =
    previous === null
      ? { participantsCount: INITIAL_PARTICIPANTS, totalBonuses: INITIAL_TOTAL_BONUSES }
      : {
          participantsCount: previous.participantsCount + randomInt(PARTICIPANTS_STEP.min, PARTICIPANTS_STEP.max),
          totalBonuses: previous.totalBonuses + randomInt(BONUS_STEP.min, BONUS_STEP.max),
        };

  try {
    const created = await prisma.appStats.create({
      data: { date: today, participantsCount: next.participantsCount, totalBonuses: next.totalBonuses },
    });
    return { date: created.date, participantsCount: created.participantsCount, totalBonuses: created.totalBonuses };
  } catch (error) {
    // Параллельный первый запрос дня уже создал запись — используем её.
    if (isUniqueViolation(error)) {
      const raced = await prisma.appStats.findUnique({ where: { date: today } });
      if (raced) {
        return { date: raced.date, participantsCount: raced.participantsCount, totalBonuses: raced.totalBonuses };
      }
    }
    throw error;
  }
}
