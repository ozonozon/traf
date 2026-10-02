import { getRequestedChannelIds } from "@/lib/db";
import { handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { TELEGRAM_CHANNELS } from "@/config/telegram-channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/channel-requests — статус заявок текущего пользователя (кнопка «Проверить заявки»).
 *
 * Данные берутся из таблицы channel_requests: там оказываются только реальные
 * chat_join_request от Telegram. Нажатие «Подписаться» здесь ничего не меняет.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const requestedChannelIds = await getRequestedChannelIds(user.telegram_id);

    const channels = TELEGRAM_CHANNELS.map((channel) => ({
      id: channel.id,
      index: channel.index,
      title: channel.title,
      requested: requestedChannelIds.includes(channel.id),
    }));
    const requestedCount = channels.filter((channel) => channel.requested).length;

    return jsonOk({
      channels,
      requestedCount,
      total: channels.length,
      allRequested: requestedCount >= channels.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
