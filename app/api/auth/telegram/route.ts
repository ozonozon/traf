import type { NextRequest } from "next/server";

import {
  ensureDemoUser,
  getCurrentUser,
  isDemoAllowed,
  setSessionCookie,
  toPublicUser,
  upsertTelegramUser,
  validateTelegramInitData,
} from "@/lib/auth";
import { RouteError, handleRouteError, jsonOk } from "@/lib/http";
import { getTelegramBotToken } from "@/lib/env";
import { formatZodIssues, telegramAuthSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/telegram
 *
 * Принимает ТОЛЬКО initData из Telegram WebApp. Сервер сам проверяет подпись
 * через TELEGRAM_BOT_TOKEN и сам определяет пользователя: telegram id из фронтенда
 * не принимается как доверенный параметр.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = telegramAuthSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new RouteError("VALIDATION_ERROR", "Проверьте данные запроса", 422, formatZodIssues(parsed.error));
    }

    const botToken = getTelegramBotToken();
    const { initData } = parsed.data;

    // 1. Валидный Telegram initData.
    if (initData && botToken) {
      const verification = validateTelegramInitData(initData, botToken);
      if (!verification.valid || !verification.user) {
        throw new RouteError("INVALID_INIT_DATA", "Не удалось проверить данные Telegram", 401);
      }
      const user = await upsertTelegramUser(verification.user);
      await setSessionCookie(user.id);
      return jsonOk({ user: toPublicUser(user), mode: "telegram" });
    }

    // 2. Локальная разработка вне Telegram (в production выключено).
    if (isDemoAllowed()) {
      const user = await ensureDemoUser();
      await setSessionCookie(user.id);
      return jsonOk({ user: toPublicUser(user), mode: "demo" });
    }

    if (initData && !botToken) {
      throw new RouteError("TELEGRAM_UNAVAILABLE", "Авторизация через Telegram не настроена", 503);
    }
    throw new RouteError("UNAUTHORIZED", "Нужно открыть приложение внутри Telegram", 401);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** GET /api/auth/telegram — текущая сессия (для проверки авторизации). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new RouteError("UNAUTHORIZED", "Нужно открыть приложение внутри Telegram", 401);
    }
    return jsonOk({ user: toPublicUser(user), mode: user.isDemo ? "demo" : "telegram" });
  } catch (error) {
    return handleRouteError(error);
  }
}
