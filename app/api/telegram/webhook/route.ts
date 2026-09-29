import { NextResponse } from "next/server";

import { findChannelByInvite } from "@/config/telegram-channels";
import { createJoinTicket } from "@/lib/join-ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Текст приветствия на /start. */
const START_TEXT =
  "Привет! Твои задания уже ждут тебя, нажимай кнопку внизу «Открыть», выполняй их и зарабатывай реальные деньги!";

/** Telegram присылает Update только методом POST. */
export async function GET() {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

/** Минимальный срез Telegram Update. */
interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
  chat_join_request?: {
    from?: { id?: number };
    chat?: { id?: number };
    invite_link?: { invite_link?: string };
  };
}

/** POST к Bot API с безопасной обработкой ошибок (токен не раскрывается). */
async function callBotApi(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; details?: string }> {
  let response: Response | null = null;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    // Сетевая ошибка: URL с токеном в ответ не попадает.
    response = null;
  }

  const payload = response
    ? ((await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null)
    : null;

  if (!response || !payload?.ok) {
    return { ok: false, details: payload?.description ?? "Telegram API недоступен" };
  }
  return { ok: true };
}

/**
 * Заявка на вступление в закрытый канал (chat_join_request).
 *
 * Заявку невозможно подделать со стороны клиента: update приходит от Telegram.
 * Определяем канал по invite-ссылке из заявки (постоянные ссылки из конфига), затем
 * отправляем пользователю кнопку с подписанным тикетом. Тикет применяется в приложении
 * и выставляет channelNRequested = true в подписанном состоянии (cookie).
 * Подписки через getChatMember не проверяются.
 */
async function handleJoinRequest(update: TelegramUpdate): Promise<NextResponse> {
  const joinRequest = update.chat_join_request;
  const telegramUserId = joinRequest?.from?.id;
  const channel = findChannelByInvite(joinRequest?.invite_link?.invite_link, joinRequest?.chat?.id ?? null);

  if (typeof telegramUserId !== "number" || !channel) {
    // Заявка не по нашим каналам или нет данных — просто игнорируем.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!appUrl) {
    console.error("[telegram-webhook] chat_join_request: NEXT_PUBLIC_APP_URL не настроен");
    return NextResponse.json({ ok: true, joinRequest: { channel: channel.index }, notified: false });
  }

  const ticket = createJoinTicket(telegramUserId, channel.index);
  const separator = appUrl.includes("?") ? "&" : "?";

  const result = await callBotApi("sendMessage", {
    chat_id: telegramUserId,
    text: `Заявка на «${channel.title}» отправлена. Нажмите «Открыть», чтобы засчитать её в приложении.`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть",
            web_app: { url: `${appUrl}${separator}join=${encodeURIComponent(ticket)}` },
          },
        ],
      ],
    },
  });

  if (!result.ok) {
    // Сообщение-подтверждение не критично: состояние применится при следующей заявке/открытии.
    console.error(`[telegram-webhook] chat_join_request: sendMessage не удалось — ${result.details ?? "ошибка"}`);
    return NextResponse.json({ ok: true, joinRequest: { channel: channel.index }, notified: false });
  }

  return NextResponse.json({ ok: true, joinRequest: { channel: channel.index }, notified: true });
}

/**
 * POST /api/telegram/webhook — Update от Telegram Bot API.
 *
 * chat_join_request → подтверждение заявки кнопкой с тикетом (см. handleJoinRequest).
 * message /start    → приветствие с кнопкой «Открыть».
 * Всё остальное игнорируется.
 */
export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  // 1. Заявка на вступление в канал (обрабатывается до /start и не влияет на него).
  if (update?.chat_join_request) {
    return handleJoinRequest(update);
  }

  // 2. Команда /start — без изменений.
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  // Не /start (или нечего отправлять) — ничего не делаем.
  if (typeof text !== "string" || !text.startsWith("/start") || typeof chatId !== "number") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await callBotApi("sendMessage", {
    chat_id: chatId,
    text: START_TEXT,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть",
            web_app: { url: process.env.NEXT_PUBLIC_APP_URL },
          },
        ],
      ],
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        delivered: false,
        error: "TELEGRAM_API_ERROR",
        // Только описание от Telegram (токен не раскрывается).
        details: result.details,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, delivered: true });
}


