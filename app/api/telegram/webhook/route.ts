import { NextResponse } from "next/server";

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
}

/**
 * POST /api/telegram/webhook — Update от Telegram Bot API.
 *
 * /start → sendMessage с кнопкой «Открыть» (Web App).
 * Всё остальное игнорируется.
 */
export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  // Не /start (или нечего отправлять) — ничего не делаем.
  if (typeof text !== "string" || !text.startsWith("/start") || typeof chatId !== "number") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let response: Response | null = null;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        chat_id: chatId,
        text: START_TEXT,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть",
                web_app: {
                  url: process.env.NEXT_PUBLIC_APP_URL,
                },
              },
            ],
          ],
        },
      }),
    });
  } catch {
    // Сетевая ошибка: URL с токеном в ответ не попадает.
    response = null;
  }

  const payload = response ? ((await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null) : null;

  if (!response || !payload?.ok) {
    return NextResponse.json(
      {
        ok: false,
        delivered: false,
        error: "TELEGRAM_API_ERROR",
        // Только описание от Telegram (токен не раскрывается).
        details: payload?.description ?? "Telegram API недоступен",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, delivered: true });
}

