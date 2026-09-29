import type { NextRequest } from "next/server";

import { RouteError, handleRouteError, jsonOk, requireUser } from "@/lib/http";
import { verifyJoinTicket } from "@/lib/join-ticket";
import { isChannelRequested, markChannelRequested, saveUserState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/join-request
 *
 * Применяет подписанный тикет заявки (его выдал webhook, получив chat_join_request
 * от Telegram) к состоянию пользователя в подписанной cookie.
 *
 * Тикет выпускается только в обработчике chat_join_request, привязан к telegram-id
 * и номеру канала, подписан HMAC-SHA256 и имеет срок действия. Клиент не может
 * «выдумать» заявку: без действительного тикета состояние не меняется.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const rawBody: unknown = await request.json().catch(() => ({}));
    const ticket = typeof (rawBody as { ticket?: unknown })?.ticket === "string" ? (rawBody as { ticket: string }).ticket : "";

    const payload = verifyJoinTicket(ticket);
    if (!payload) {
      throw new RouteError("INVALID_TICKET", "Ссылка подтверждения недействительна", 400);
    }
    if (payload.uid !== user.telegramId) {
      throw new RouteError("TICKET_FOR_OTHER_USER", "Эта заявка относится к другому пользователю", 403);
    }

    const alreadyRequested = isChannelRequested(user, payload.channel);
    const nextState = alreadyRequested ? user : markChannelRequested(user, payload.channel);
    if (!alreadyRequested) {
      await saveUserState(nextState);
    }

    return jsonOk({
      ok: true,
      channel: payload.channel,
      requested: {
        1: isChannelRequested(nextState, 1),
        2: isChannelRequested(nextState, 2),
        3: isChannelRequested(nextState, 3),
      },
      allRequested: isChannelRequested(nextState, 1) && isChannelRequested(nextState, 2) && isChannelRequested(nextState, 3),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
