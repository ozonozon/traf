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
 * Результат проверки initData. Возвращаются только безопасные факты:
 * длины, имена полей, возраст auth_date — без значений initData, токена и user.
 */
export interface InitDataDiagnostics {
  initDataPresent: boolean;
  initDataLength: number;
  hashPresent: boolean;
  hashLength: number;
  computedHashLength: number;
  hashMatch: boolean;
  userPresent: boolean;
  authDatePresent: boolean;
  authDate: number | null;
  authAgeSeconds: number | null;
  botTokenConfigured: boolean;
  fields: string[];
}

export type InitDataFailure =
  | "INIT_DATA_MISSING"
  | "BOT_TOKEN_MISSING"
  | "HASH_MISSING"
  | "HASH_MISMATCH"
  | "AUTH_DATE_MISSING"
  | "AUTH_DATE_EXPIRED"
  | "USER_INVALID";

export interface InitDataVerification {
  valid: boolean;
  /** Причина отказа (null при valid: true). */
  reason: InitDataFailure | null;
  user?: TelegramUser;
  authDate?: Date;
  diagnostics: InitDataDiagnostics;
}

/**
 * Проверка Telegram initData строго по официальной схеме
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *
 *  1. берём RAW-строку initData (без повторного кодирования/декодирования);
 *  2. парсим её как query-строку;
 *  3. достаём hash;
 *  4. исключаем hash (и signature) из набора полей;
 *  5. сортируем оставшиеся поля по имени;
 *  6. собираем data_check_string как "key=value" через "\n";
 *  7. secret_key = HMAC_SHA256(key="WebAppData", message=botToken);
 *  8. hash = HMAC_SHA256(key=secret_key, message=data_check_string);
 *  9. сравниваем с полученным hash безопасным способом;
 * 10. проверяем auth_date (initData старше 24 часов не принимается);
 * 11. из поля user берём telegram id.
 *
 * Значения, которые сюда приходят, никогда не логируются.
 */
export function validateTelegramInitData(initData: string, botToken: string): InitDataVerification {
  const raw = typeof initData === "string" ? initData : "";
  const params = new URLSearchParams(raw);
  const hash = params.get("hash") ?? "";
  const authDateRaw = Number(params.get("auth_date") ?? 0);
  const authAgeSeconds = authDateRaw ? Math.floor(Date.now() / 1000) - authDateRaw : null;

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const computedBuffer = Buffer.from(computedHash, "utf8");
  const receivedBuffer = Buffer.from(hash, "utf8");
  const hashMatch =
    Boolean(hash) && computedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(computedBuffer, receivedBuffer);

  const rawUser = params.get("user");
  let user: TelegramUser | undefined;
  let userValid = Boolean(rawUser);
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as TelegramUser;
      userValid = typeof user?.id === "number";
    } catch {
      user = undefined;
      userValid = false;
    }
  }

  const diagnostics: InitDataDiagnostics = {
    initDataPresent: raw.length > 0,
    initDataLength: raw.length,
    hashPresent: Boolean(hash),
    hashLength: hash.length,
    computedHashLength: computedHash.length,
    hashMatch,
    userPresent: Boolean(rawUser),
    authDatePresent: Boolean(authDateRaw),
    authDate: authDateRaw || null,
    authAgeSeconds,
    botTokenConfigured: Boolean(botToken),
    fields: [...params.keys()],
  };

  const fail = (reason: InitDataFailure): InitDataVerification => {
    console.warn(`[telegram-auth] initData отклонён: ${reason}`, {
      ...diagnostics,
      hint:
        reason === "HASH_MISMATCH"
          ? "hash не совпал: проверьте, что TELEGRAM_BOT_TOKEN принадлежит тому же боту, который открывает Mini App"
          : undefined,
    });
    return { valid: false, reason, diagnostics };
  };

  if (!raw) return fail("INIT_DATA_MISSING");
  if (!botToken) return fail("BOT_TOKEN_MISSING");
  if (!hash) return fail("HASH_MISSING");
  if (!hashMatch) return fail("HASH_MISMATCH");
  if (!authDateRaw) return fail("AUTH_DATE_MISSING");
  if (authAgeSeconds !== null && authAgeSeconds > INIT_DATA_MAX_AGE_SECONDS) return fail("AUTH_DATE_EXPIRED");
  if (!userValid) return fail("USER_INVALID");

  return { valid: true, reason: null, user, authDate: new Date(authDateRaw * 1000), diagnostics };
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
 * Пользователь по initData, пришедшему заголовком (или прямо из запроса).
 *
 * Используется, когда клиент не прислал сессионную cookie (Telegram Web/Desktop
 * открывает Mini App в iframe, и браузер может не сохранить стороннюю cookie).
 * Проверка та же самая, что и при входе: HMAC-подпись initData из TELEGRAM_BOT_TOKEN
 * плюс срок auth_date. Если пользователя ещё нет в PostgreSQL — создаём его тем же
 * upsert, что и вход (INSERT ... ON CONFLICT DO UPDATE), чтобы данные не потерялись.
 */
export async function getUserFromInitData(rawInitData: string | null): Promise<UserRow | null> {
  const botToken = getTelegramBotToken();
  if (!rawInitData || !botToken) return null;

  const verification = validateTelegramInitData(rawInitData, botToken);
  if (!verification.valid || !verification.user) return null;

  const telegramId = String(verification.user.id);
  const existing = await getUserByTelegramId(telegramId);
  if (existing) return existing;

  return upsertUser({
    telegramId,
    username: verification.user.username ?? null,
    firstName: verification.user.first_name || "Пользователь",
    lastName: verification.user.last_name ?? null,
    photoUrl: verification.user.photo_url ?? null,
  });
}
