import "server-only";

import { prisma } from "./db";
import type { UserModel } from "./generated/prisma/models";
import type { TelegramUser } from "./telegram";
import type { PublicUserDto } from "./types";

/**
 * Серверная работа с пользователями приложения.
 * Prisma доступна только через server-only слой `lib/db.ts`.
 */

export { provisionDemoUser as ensureDemoUser, DEMO_BALANCE, DEMO_TELEGRAM_ID } from "./demo-user";

/**
 * Публичное представление пользователя для API.
 * Наружу уходят только те поля, которые реально нужны интерфейсу:
 * без telegramId, без внутренних идентификаторов и служебных флагов вроде isMock.
 */
export function toPublicUser(user: UserModel): PublicUserDto {
  return {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    balance: user.balance,
    totalEarned: user.totalEarned,
    completedTasks: user.completedTasks,
    isDemo: user.isDemo,
  };
}

/** Создание/обновление пользователя по данным Telegram. */
export async function upsertTelegramUser(telegramUser: TelegramUser): Promise<UserModel> {
  const telegramId = String(telegramUser.id);
  const profile = {
    username: telegramUser.username ?? null,
    firstName: telegramUser.first_name || "Пользователь",
    lastName: telegramUser.last_name ?? null,
    photoUrl: telegramUser.photo_url ?? null,
  };

  return prisma.user.upsert({
    where: { telegramId },
    update: profile,
    create: { telegramId, ...profile },
  });
}

