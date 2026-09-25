import "server-only";

import { startOfToday } from "./dates";
import { prisma } from "./db";
import { cryptoRandom, generateMockProfile, type RandomSource } from "./mock-users";

/**
 * Ежедневная динамика рейтинга.
 *
 * Один раз в календарный день (идемпотентно, за счёт уникальной даты в
 * LeaderboardDailyUpdate):
 *  1) 10–25% demo-участников получают личную прибавку +500…1000 к totalEarned;
 *  2) добавляется 2–4 новых demo-участника с начальным заработком.
 *
 * Реальные пользователи (в т.ч. текущий) прибавок не получают: их заработок — это
 * реально заработанные виртуальные рубли, позиция в рейтинге считается по ним.
 */

export const LEADERBOARD_TOP_LIMIT = 30;

const DAILY_SHARE_PERCENT = { min: 10, max: 25 } as const;
const DAILY_BONUS = { min: 500, max: 1_000 } as const;
const NEW_USERS_PER_DAY = { min: 2, max: 4 } as const;
const NEW_USER_EARNINGS = { min: 5_000, max: 12_000 } as const;

/** «Низкий» пул: участники ниже уровня текущего пользователя (двигают его позицию). */
const LOW_TIER_MAX = 400;
const LOW_TIER_EARNINGS = { min: 80, max: 350 } as const;
const LOW_TIER_POOL_MIN = 8;

export interface DailyUpdateResult {
  date: Date;
  /** true — обновление выполнил именно этот запрос; false — день уже был обновлён. */
  created: boolean;
  updatedUsers: number;
  createdUsers: number;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Случайная выборка без повторов. */
function pickMany<T>(random: RandomSource, values: T[], count: number): T[] {
  const pool = [...values];
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    result.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
  }
  return result;
}

/** Уникальный telegramId для сгенерированного участника. */
function nextMockTelegramId(index: number): string {
  return `9${Date.now()}${index}`;
}

/**
 * Ежедневное обновление рейтинга. Идемпотентно: при параллельных запросах
 * сработает уникальная дата в LeaderboardDailyUpdate, второй вызов ничего не изменит.
 */
export async function ensureDailyLeaderboardUpdate(random: RandomSource = cryptoRandom): Promise<DailyUpdateResult> {
  const today = startOfToday();

  const existing = await prisma.leaderboardDailyUpdate.findUnique({ where: { date: today } });
  if (existing) {
    return { date: today, created: false, updatedUsers: existing.updatedUsers, createdUsers: existing.createdUsers };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Запись дня создаётся первой: уникальная дата — это lock от параллельных запусков.
      const record = await tx.leaderboardDailyUpdate.create({ data: { date: today } });

      // 1. Прибавка части demo-участников (у каждого своя сумма).
      const mocks = await tx.user.findMany({
        where: { isMock: true },
        select: { id: true, totalEarned: true },
      });

      const sharePercent = random.int(DAILY_SHARE_PERCENT.min, DAILY_SHARE_PERCENT.max);
      const winners = pickMany(random, mocks, Math.max(1, Math.round((mocks.length * sharePercent) / 100)));

      for (const winner of winners) {
        const bonus = random.int(DAILY_BONUS.min, DAILY_BONUS.max);
        await tx.user.update({
          where: { id: winner.id },
          data: { totalEarned: { increment: bonus }, balance: { increment: bonus } },
        });
      }

      // 2. Новые demo-участники. Если «низкого» пула мало — часть новых идёт в нижний диапазон,
      //    чтобы позиция реального пользователя продолжала немного двигаться.
      const lowPool = await tx.user.count({ where: { isMock: true, totalEarned: { lt: LOW_TIER_MAX } } });
      const totalNew = random.int(NEW_USERS_PER_DAY.min, NEW_USERS_PER_DAY.max);
      const lowNeeded = lowPool < LOW_TIER_POOL_MIN ? Math.min(totalNew, LOW_TIER_POOL_MIN - lowPool) : 0;

      for (let index = 0; index < totalNew; index += 1) {
        const isLowTier = index < lowNeeded;
        const range = isLowTier ? LOW_TIER_EARNINGS : NEW_USER_EARNINGS;
        const profile = generateMockProfile(random, {
          telegramId: nextMockTelegramId(index + 1),
          totalEarned: random.int(range.min, range.max),
        });

        await tx.user.create({
          data: { ...profile, isMock: true, balance: Math.round(profile.totalEarned * 0.22) },
        });
      }

      const updated = await tx.leaderboardDailyUpdate.update({
        where: { id: record.id },
        data: { updatedUsers: winners.length, createdUsers: totalNew },
      });

      return {
        date: today,
        created: true,
        updatedUsers: updated.updatedUsers,
        createdUsers: updated.createdUsers,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await prisma.leaderboardDailyUpdate.findUnique({ where: { date: today } });
      return {
        date: today,
        created: false,
        updatedUsers: raced?.updatedUsers ?? 0,
        createdUsers: raced?.createdUsers ?? 0,
      };
    }
    throw error;
  }
}
