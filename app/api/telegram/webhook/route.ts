import { NextResponse } from "next/server";

import { findChannelByInvite } from "@/config/telegram-channels";
import { branding } from "@/config/branding";
import { addChannelRequest } from "@/lib/db";

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
 * Заявку нельзя подделать со стороны клиента: update приходит от Telegram.
 * Канал определяется по invite-ссылке из заявки (постоянные ссылки из конфига),
 * затем заявка записывается в таблицу channel_requests:
 *   INSERT ... ON CONFLICT (telegram_id, channel_id) DO NOTHING
 * Никаких cookie и тикетов для хранения заявки не используется.
 * Подписки через getChatMember не проверяются.
 */
async function handleJoinRequest(update: TelegramUpdate): Promise<NextResponse> {
  const joinRequest = update.chat_join_request;
  const telegramUserId = joinRequest?.from?.id;
  const inviteLink = joinRequest?.invite_link?.invite_link ?? null;
  const channel = findChannelByInvite(inviteLink, joinRequest?.chat?.id ?? null);

  if (typeof telegramUserId !== "number" || !channel) {
    // Заявка не по нашим каналам или нет данных — просто игнорируем.
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const created = await addChannelRequest({
      telegramId: String(telegramUserId),
      channelId: channel.id,
      inviteLink,
    });

    return NextResponse.json({
      ok: true,
      joinRequest: { channel: channel.index, channelId: channel.id, created },
    });
  } catch (error) {
    // Ошибку базы не раскрываем наружу, в лог уходит только тип.
    console.error("[telegram-webhook] chat_join_request: не удалось сохранить заявку", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { ok: false, delivered: false, error: "DATABASE_ERROR", details: "Не удалось сохранить заявку" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/telegram/webhook — Update от Telegram Bot API.
 *
 * chat_join_request → запись заявки в PostgreSQL (см. handleJoinRequest).
 * message /start    → ОДНО сообщение: баннер (sendPhoto) + текст приветствия + кнопка «Открыть».
 * Всё остальное игнорируется.
 */
export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  // 1. Заявка на вступление в канал (обрабатывается до /start и не влияет на него).
  if (update?.chat_join_request) {
    return handleJoinRequest(update);
  }

  // 2. Команда /start.
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  // Не /start (или нечего отправлять) — ничего не делаем.
  if (typeof text !== "string" || !text.startsWith("/start") || typeof chatId !== "number") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Адрес Mini App и баннера берём из NEXT_PUBLIC_APP_URL: только абсолютный HTTPS.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!appUrl.startsWith("https://")) {
    console.error("[telegram-webhook] /start: NEXT_PUBLIC_APP_URL должен быть абсолютным HTTPS-адресом");
    return NextResponse.json(
      {
        ok: false,
        delivered: false,
        error: "APP_URL_INVALID",
        details: "NEXT_PUBLIC_APP_URL должен начинаться с https://",
      },
      { status: 500 },
    );
  }

  // Одно сообщение: картинка + текст + кнопка (sendPhoto с caption, без отдельной отправки картинки).
  const result = await callBotApi("sendPhoto", {
    chat_id: chatId,
    photo: `${appUrl}${branding.startBanner}`,
    caption: START_TEXT,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть",
            web_app: { url: appUrl },
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


