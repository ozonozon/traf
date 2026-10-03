import type { NextRequest } from "next/server";

import {
  isDemoAllowed,
  signInAsDemo,
  signInWithTelegram,
  toPublicUser,
  validateTelegramInitData,
} from "@/lib/auth";
import { RouteError, handleRouteError, jsonOk, requireUser } from "@/lib/http";
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

    // 1. Валидный Telegram initData: пользователь создаётся/обновляется в PostgreSQL.
    if (initData && botToken) {
      const verification = validateTelegramInitData(initData, botToken);
      if (!verification.valid || !verification.user) {
        console.warn("[telegram-auth] POST /api/auth/telegram: initData не принят", verification.reason);
        throw new RouteError("INVALID_INIT_DATA", "Не удалось проверить данные Telegram", 401, undefined, {
          reason: verification.reason ?? "INVALID_INIT_DATA",
          diagnostics: verification.diagnostics,
        });
      }
      const user = await signInWithTelegram(verification.user);
      return jsonOk({ user: toPublicUser(user), mode: "telegram" });
    }

    // 2. Локальная разработка вне Telegram (в production выключено).
    if (isDemoAllowed()) {
      const user = await signInAsDemo();
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
    // Тот же механизм, что и у остальных защищённых роутов: cookie или initData в заголовке.
    const user = await requireUser();
    return jsonOk({ user: toPublicUser(user), mode: user.is_demo ? "demo" : "telegram" });
  } catch (error) {
    return handleRouteError(error);
  }
}
