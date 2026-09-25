import "server-only";

import crypto from "node:crypto";

import { isProduction } from "./env";
import {
  createDemoState,
  createTelegramState,
  readUserState,
  refreshTelegramProfile,
  saveUserState,
  type UserState,
} from "./store";
import type { TelegramUser } from "./telegram";

export { toPublicUser } from "./store";

const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24;

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

// --- Сессия (подписанная httpOnly-cookie с состоянием пользователя) ---

/** Текущее состояние пользователя или null (например, до авторизации). */
export async function getCurrentUser(): Promise<UserState | null> {
  return readUserState();
}

/** Вход по данным Telegram: профиль обновляется, заработанное сохраняется. */
export async function signInWithTelegram(
  current: UserState | null,
  telegramUser: TelegramUser,
): Promise<UserState> {
  const next = current ? refreshTelegramProfile(current, telegramUser) : createTelegramState(telegramUser);
  await saveUserState(next);
  return next;
}

/** Вход в демо-режиме (локальная разработка вне Telegram). */
export async function signInAsDemo(current: UserState | null): Promise<UserState> {
  const next = current?.isDemo ? current : createDemoState();
  await saveUserState(next);
  return next;
}


