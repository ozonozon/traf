import type { NextRequest } from "next/server";

import { validateTelegramInitData } from "@/lib/auth";
import { getTelegramBotToken } from "@/lib/env";
import { handleRouteError, jsonOk } from "@/lib/http";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram";
import { getBotIdentity } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ВРЕМЕННЫЙ диагностический endpoint (удалить после отладки).
 *
 * POST /api/debug/telegram-auth
 *   body: { "initData": "<raw initData>" } или заголовок X-Telegram-Init-Data
 * GET  /api/debug/telegram-auth
 *   использует только заголовок X-Telegram-Init-Data
 *
 * Возвращает ТОЛЬКО безопасные факты: без initData, токена, cookie и данных пользователя.
 * `bot` показывает, какому боту принадлежит TELEGRAM_BOT_TOKEN (getMe) — так можно убедиться,
 * что Mini App открыт тем же ботом.
 */
async function diagnose(request: NextRequest) {
  const fromHeader = request.headers.get(TELEGRAM_INIT_DATA_HEADER) ?? "";
  let initData = fromHeader;

  if (!initData && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { initData?: unknown };
    initData = typeof body.initData === "string" ? body.initData : "";
  }

  const verification = validateTelegramInitData(initData, getTelegramBotToken());
  const bot = await getBotIdentity();

  return jsonOk({
    telegramWebAppDetected: Boolean(initData),
    initDataPresent: verification.diagnostics.initDataPresent,
    initDataLength: verification.diagnostics.initDataLength,
    hashPresent: verification.diagnostics.hashPresent,
    userPresent: verification.diagnostics.userPresent,
    authDatePresent: verification.diagnostics.authDatePresent,
    authDate: verification.diagnostics.authDate,
    authAgeSeconds: verification.diagnostics.authAgeSeconds,
    validation: verification.valid ? "valid" : (verification.reason ?? "invalid"),
    botTokenConfigured: bot.tokenConfigured,
    botTokenValid: bot.tokenValid,
    botUsername: bot.username,
    botError: bot.error,
    fields: verification.diagnostics.fields,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await diagnose(request);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await diagnose(request);
  } catch (error) {
    return handleRouteError(error);
  }
}
