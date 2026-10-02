import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";

import { getAuthSecret, isProduction } from "./env";

/**
 * Сессия Mini App — минимальная подписанная httpOnly-cookie.
 *
 * Внутри только telegram-id: все данные пользователя (баланс, заявки, выполненные
 * задания, операции) живут в PostgreSQL. Никакого состояния в cookie больше нет.
 */

export const SESSION_COOKIE = "voxy_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload {
  uid: string;
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionToken(telegramId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: telegramId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    "utf8",
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (!parsed.uid || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: parsed.uid, exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function setSessionCookie(telegramId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(telegramId), {
    httpOnly: true,
    // В production приложение может открываться внутри iframe (Telegram Web/Desktop),
    // поэтому cookie должна быть доступна и в стороннем контексте: SameSite=None + Secure.
    sameSite: isProduction() ? "none" : "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSessionTelegramId(): Promise<string | null> {
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value);
  return session?.uid ?? null;
}
