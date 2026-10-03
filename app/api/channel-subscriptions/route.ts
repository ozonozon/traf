import { headers } from "next/headers";

import { validateTelegramInitData } from "@/lib/auth";
import { assertChannelsCheckable, checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { getTelegramBotToken } from "@/lib/env";
import { RouteError, handleRouteError, jsonError, jsonOk, requireUser } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Диагностика причины 401: что именно пришло в запросе и почему requireUser() отказал.
 * Логируются только факты и длины — без значений initData, cookie, токена и персданных.
 */
async function describeUnauthorized(): Promise<string> {
  const requestHeaders = await headers();
  const rawInitData = requestHeaders.get(TELEGRAM_INIT_DATA_HEADER) ?? "";
  const hasCookie = Boolean(requestHeaders.get("cookie")?.includes(`${SESSION_COOKIE}=`));
  const botToken = getTelegramBotToken();
  const initDataValid = rawInitData ? validateTelegramInitData(rawInitData, botToken).valid : false;

  console.warn(
    `[channel-subscriptions] requireUser() вернул 401: X-Telegram-Init-Data ${
      rawInitData ? `есть (длина ${rawInitData.length}, подпись ${initDataValid ? "валидна" : "невалидна"})` : "отсутствует"
    }, cookie ${SESSION_COOKIE} ${hasCookie ? "есть" : "отсутствует"}`,
  );

  if (!rawInitData && !hasCookie) return "NO_INIT_DATA_NO_COOKIE";
  if (!rawInitData) return "COOKIE_INVALID";
  if (!initDataValid) return hasCookie ? "INIT_DATA_INVALID_COOKIE_INVALID" : "INIT_DATA_INVALID";

  // initData валиден, но пользователь не нашёлся/не создался в PostgreSQL.
  return "INIT_DATA_VALID_USER_LOOKUP_FAILED";
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
      const reason = await describeUnauthorized();
      return jsonError(error.code, error.message, error.status, undefined, { reason });
    }

    return handleRouteError(error);
  }
}
