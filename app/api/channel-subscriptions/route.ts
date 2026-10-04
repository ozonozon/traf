import { assertChannelsCheckable, checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return handleRouteError(error);
  }
}
