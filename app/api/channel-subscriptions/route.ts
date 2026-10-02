import { headers } from "next/headers";

import { getUserFromInitData } from "@/lib/auth";
import { assertChannelsCheckable, checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { RouteError, handleRouteError, jsonOk } from "@/lib/http";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/channel-subscriptions — фактическая подписка текущего пользователя
 * на обязательные Telegram-каналы.
 *
 * Авторизация только по Telegram initData: клиент присылает его заголовком
 * `X-Telegram-Init-Data` (тот же initData, что получен от Telegram WebApp), сервер
 * валидирует его существующей `validateTelegramInitData` и получает telegram_id.
 * Cookie, session и channel_requests здесь не используются вообще.
 *
 * Для каждого канала из config/telegram-channels.ts сервер вызывает Telegram Bot API
 * `getChatMember` и считает подпиской member / administrator / creator / restricted.
 * Ошибки Telegram подпиской не считаются.
 */
export async function GET() {
  try {
    const rawInitData = (await headers()).get(TELEGRAM_INIT_DATA_HEADER);
    const user = await getUserFromInitData(rawInitData);
    if (!user) {
      throw new RouteError("UNAUTHORIZED", "Telegram не передал данные приложения. Откройте Mini App заново.", 401);
    }

    const check = await checkChannelSubscriptions(user.telegram_id);
    assertChannelsCheckable(check);

    return jsonOk({
      channels: check.channels,
      subscribedCount: check.subscribedCount,
      total: check.total,
      allSubscribed: check.allSubscribed,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
