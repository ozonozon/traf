import { NextResponse } from "next/server";

import { getMiniAppUrl, getTelegramBotToken } from "@/lib/env";
import { START_MESSAGE_TEXT, buildOpenMiniAppKeyboard, sendTelegramMessage } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/webhook — Telegram Update от Bot API.
 *
 * Обрабатывается только команда /start (в том числе `/start <payload>` и
 * `/start@botname`): бот отправляет приветствие с inline-кнопкой «Открыть»,
 * которая открывает существующий Mini App. Любые другие update игнорируются
 * и не приводят к ошибке.
 *
 * Никаких состояний и БД: повторный /start всегда отправляет то же сообщение.
 * Полный Telegram Update в логи не пишется.
 */

/** Минимальный срез Telegram Update, который нужен этому роуту. */
interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
}

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** `/start`, `/start payload`, `/start@botname`, `/start@botname payload`. */
function isStartCommand(text: string): boolean {
  const command = text.trim().split(/\s+/)[0]?.split("@")[0]?.toLowerCase();
  return command === "/start";
}

/** Webhook принимает только POST: GET отвечает 405. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Конфигурация: без токена и без адреса Mini App работать нельзя.
  if (!getTelegramBotToken()) {
    console.error("[telegram-webhook] TELEGRAM_BOT_TOKEN не настроен");
    return json({ ok: false, error: "BOT_NOT_CONFIGURED" }, 503);
  }

  const appUrl = getMiniAppUrl();
  if (!appUrl) {
    console.error("[telegram-webhook] NEXT_PUBLIC_APP_URL не настроен");
    return json({ ok: false, error: "APP_URL_NOT_CONFIGURED" }, 503);
  }

  // 2. Тело запроса: битый JSON и любые чужие типы update не должны ломать endpoint.
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  if (typeof text !== "string" || typeof chatId !== "number") {
    return json({ ok: true, ignored: true });
  }

  if (!isStartCommand(text)) {
    return json({ ok: true, ignored: true });
  }

  // 3. Ответ уходит ровно в тот чат, откуда пришло сообщение (message.chat.id).
  const result = await sendTelegramMessage(chatId, START_MESSAGE_TEXT, buildOpenMiniAppKeyboard(appUrl));

  if (!result.ok) {
    // Безопасный лог: без токена и без полного update.
    console.error(
      `[telegram-webhook] sendMessage не удалось (chat_id=${chatId}, code=${result.errorCode ?? "-"}): ${result.error ?? "неизвестная ошибка"}`,
    );
    // 200, чтобы Telegram не повторял один и тот же update бесконечно.
    return json({ ok: true, delivered: false });
  }

  return json({ ok: true, delivered: true });
}
