import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";

import { getAuthSecret, isProduction } from "./env";
import { prisma } from "./db";
import type { UserModel } from "./generated/prisma/models";
import type { TelegramUser } from "./telegram";

export { DEMO_BALANCE, DEMO_TELEGRAM_ID, ensureDemoUser, toPublicUser, upsertTelegramUser } from "./users";

export const SESSION_COOKIE = "voxy_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
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

// --- Сессия (подписанная httpOnly cookie) ---

function authSecret(): string {
  return getAuthSecret();
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function readSessionToken(token: string | undefined): { userId: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(signPayload(payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: parsed.uid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value);
  return session?.userId ?? null;
}

/** Текущий пользователь из сессии (или null). */
export async function getCurrentUser(): Promise<UserModel | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

// Провижининг пользователей вынесен в lib/users.ts (переиспользуется в seed).

