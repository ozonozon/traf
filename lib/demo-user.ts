import type { UserModel } from "./generated/prisma/models";
import { prisma } from "./prisma";

/**
 * Демо-пользователь локальной разработки (когда Telegram WebApp недоступен).
 *
 * «Плоский» модуль: его использует и серверный слой (`lib/users.ts`, помеченный
 * `server-only`), и CLI-скрипт `prisma/seed.ts`. В production этот путь недоступен:
 * `isDemoAllowed()` в `lib/auth.ts` разрешает его только вне production.
 */

export const DEMO_TELEGRAM_ID = "demo_user";
export const DEMO_BALANCE = 360;

const DEMO_USERNAME = "demo_user";
const DEMO_FIRST_NAME = "Игорь";
const DEMO_LAST_NAME = "Рябов";

/** Создаёт (или возвращает) демо-пользователя с виртуальным балансом 360 ₽. */
export async function provisionDemoUser(): Promise<UserModel> {
  const user = await prisma.user.upsert({
    where: { telegramId: DEMO_TELEGRAM_ID },
    update: {},
    create: {
      telegramId: DEMO_TELEGRAM_ID,
      username: DEMO_USERNAME,
      firstName: DEMO_FIRST_NAME,
      lastName: DEMO_LAST_NAME,
      balance: DEMO_BALANCE,
      totalEarned: DEMO_BALANCE,
      completedTasks: 0,
      isDemo: true,
    },
  });

  const transactionsCount = await prisma.virtualTransaction.count({ where: { userId: user.id } });
  if (transactionsCount === 0 && user.totalEarned > 0) {
    await prisma.virtualTransaction.create({
      data: {
        userId: user.id,
        amount: user.totalEarned,
        type: "EARN",
        description: "Стартовый виртуальный баланс",
      },
    });
  }

  return user;
}
