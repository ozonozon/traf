import { headers } from "next/headers";

import { validateTelegramInitData } from "@/lib/auth";
import { assertChannelsCheckable, checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { getTelegramBotToken } from "@/lib/env";
import { RouteError, handleRouteError, jsonError, jsonOk, requireUser } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram";
import { getBotIdentity } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ВРЕМЕННАЯ ДИАГНОСТИКА причины 401 (без значений initData, токена, cookie и персданных).
 * Использует результат validateTelegramInitData и данные getMe: так сразу видно,
 * пришёл ли initData, почему он отклонён и какому боту принадлежит TELEGRAM_BOT_TOKEN.
 */
async function describeUnauthorized(): Promise<Record<string, unknown>> {
  const requestHeaders = await headers();
  const rawInitData = requestHeaders.get(TELEGRAM_INIT_DATA_HEADER) ?? "";
  const hasCookie = Boolean(requestHeaders.get("cookie")?.includes(`${SESSION_COOKIE}=`));
  const verification = validateTelegramInitData(rawInitData, getTelegramBotToken());

  if (!verification.diagnostics.initDataPresent && !hasCookie) {
    return { reason: "NO_INIT_DATA_NO_COOKIE", hasCookie };
  }
  if (!verification.diagnostics.initDataPresent) {
    return { reason: "COOKIE_INVALID", hasCookie };
  }
  if (!verification.valid) {
    const bot = await getBotIdentity();
    return {
      reason: verification.reason ?? "INIT_DATA_INVALID",
      hasCookie,
      diagnostics: verification.diagnostics,
      botUsername: bot.username,
      botTokenValid: bot.tokenValid,
    };
  }

  return { reason: "INIT_DATA_VALID_USER_LOOKUP_FAILED", hasCookie };
}

/**
 * GET /api/channel-subscriptions — фактическая подписка текущего пользователя
 * на обязательные Telegram-каналы.
 *
 * Авторизация — та же, что у остальных защищённых роутов (/api/profile, /api/transactions):
 * `requireUser()` из lib/http.ts (сначала X-Telegram-Init-Data, затем подписанная cookie).
 * telegram_id берётся только оттуда, с клиента он не принимается.
 *
 * Для каждого канала из config/telegram-channels.ts сервер вызывает Telegram Bot API
 * `getChatMember` и считает подпиской member / administrator / creator / restricted.
 * Ошибки Telegram подпиской не считаются.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const check = await checkChannelSubscriptions(user.telegram_id);
    assertChannelsCheckable(check);

    return jsonOk({
      channels: check.channels,
      subscribedCount: check.subscribedCount,
      total: check.total,
      allSubscribed: check.allSubscribed,
    });
  } catch (error) {
    if (error instanceof RouteError && error.code === "UNAUTHORIZED") {
      const details = await describeUnauthorized();
      return jsonError(error.code, error.message, error.status, undefined, details);
    }

    return handleRouteError(error);
  }
}
