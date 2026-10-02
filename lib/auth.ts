import "server-only";

import crypto from "node:crypto";

import { getUserByTelegramId, upsertUser, type UserRow } from "./db";
import { getTelegramBotToken, isProduction } from "./env";
import { getSessionTelegramId, setSessionCookie } from "./session";
import type { TelegramUser } from "./telegram";
import type { PublicUserDto } from "./types";

const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Демо-пользователь локальной разработки (NODE_ENV !== production). */
export const DEMO_TELEGRAM_ID = "999000001";

/** Демо-режим разрешён только вне production. */
export function isDemoAllowed(): boolean {
  return !isProduction();
}

/**
 * Проверка подписи Telegram initData.
 *
 * secret = HMAC_SHA256(key="WebAppData", message=botToken)
 * hash   = HMAC_SHA256(key=secret, message=dataCheckString)
 * dataCheckString — все поля кроме hash/signature, отсортированные по ключу.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): { valid: boolean; user?: TelegramUser; authDate?: Date } {
  if (!initData || !botToken) return { valid: false };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { valid: false };

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const computedBuffer = Buffer.from(computed, "utf8");
  const receivedBuffer = Buffer.from(hash, "utf8");
  if (computedBuffer.length !== receivedBuffer.length) return { valid: false };
  if (!crypto.timingSafeEqual(computedBuffer, receivedBuffer)) return { valid: false };

  const authDateSeconds = Number(params.get("auth_date") ?? 0);
  if (!authDateSeconds) return { valid: false };
  const ageSeconds = Math.floor(Date.now() / 1000) - authDateSeconds;
  if (ageSeconds > INIT_DATA_MAX_AGE_SECONDS) return { valid: false };

  const rawUser = params.get("user");
  let user: TelegramUser | undefined;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as TelegramUser;
    } catch {
      return { valid: false };
    }
  }

  return { valid: true, user, authDate: new Date(authDateSeconds * 1000) };
}

// --- Публичное представление пользователя -----------------------------------

/** Публичные поля пользователя для интерфейса (внутренние id не уходят). */
export function toPublicUser(user: UserRow): PublicUserDto {
  return {
    username: user.username,
    firstName: user.first_name ?? "Пользователь",
    lastName: user.last_name,
    photoUrl: user.photo_url,
    balance: Number(user.balance),
    totalEarned: Number(user.total_earned),
    completedTasks: Number(user.completed_tasks),
    isDemo: Boolean(user.is_demo),
  };
}

// --- Вход / текущий пользователь ---------------------------------------------

/**
 * Вход по данным Telegram: пользователь создаётся или обновляется в PostgreSQL
 * (INSERT ... ON CONFLICT DO UPDATE), затем ставится подписанная сессия.
 */
export async function signInWithTelegram(telegramUser: TelegramUser): Promise<UserRow> {
  const user = await upsertUser({
    telegramId: String(telegramUser.id),
    username: telegramUser.username ?? null,
    firstName: telegramUser.first_name || "Пользователь",
    lastName: telegramUser.last_name ?? null,
    photoUrl: telegramUser.photo_url ?? null,
  });

  await setSessionCookie(user.telegram_id);
  return user;
}

/** Демо-вход локальной разработки: тот же пользователь в базе, но с флагом is_demo. */
export async function signInAsDemo(): Promise<UserRow> {
  const user = await upsertUser({
    telegramId: DEMO_TELEGRAM_ID,
    username: "demo_user",
    firstName: "Игорь",
    lastName: "Рябов",
    photoUrl: null,
    isDemo: true,
  });

  await setSessionCookie(user.telegram_id);
  return user;
}

/** Текущий пользователь: telegram-id из сессии, данные — из PostgreSQL. */
export async function getCurrentUser(): Promise<UserRow | null> {
  const telegramId = await getSessionTelegramId();
  if (!telegramId) return null;
  return getUserByTelegramId(telegramId);
}

/**
 * Пользователь по initData, пришедшему заголовком вместо cookie.
 *
 * Используется, когда клиент не прислал сессионную cookie (Telegram Web/Desktop
 * открывает Mini App в iframe, и браузер может не сохранить стороннюю cookie).
 * Проверка та же самая, что и при входе: HMAC-подпись initData из TELEGRAM_BOT_TOKEN.
 * Пользователь только читается из PostgreSQL — запись здесь не нужна, потому что
 * вход по /api/auth/telegram уже создал его.
 */
export async function getUserFromInitData(rawInitData: string | null): Promise<UserRow | null> {
  const botToken = getTelegramBotToken();
  if (!rawInitData || !botToken) return null;

  const verification = validateTelegramInitData(rawInitData, botToken);
  if (!verification.valid || !verification.user) return null;

  return getUserByTelegramId(String(verification.user.id));
}
