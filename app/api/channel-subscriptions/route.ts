import { assertChannelsCheckable, checkChannelSubscriptions } from "@/lib/channel-subscriptions";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/channel-subscriptions — фактическая подписка текущего пользователя
 * на обязательные Telegram-каналы.
 *
 * Пользователь берётся только из серверной авторизации (`requireUser()`), telegram_id
 * клиенту не доверяется. Для каждого канала из config/telegram-channels.ts сервер
 * вызывает Telegram Bot API `getChatMember` и считает подпиской статусы
 * member / administrator / creator. Ошибки Telegram не считаются подпиской.
 *
 * Ответ:
 * { channels: [{ id, index, title, inviteLink, subscribed }], subscribedCount, total, allSubscribed }
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
