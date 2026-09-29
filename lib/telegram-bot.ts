import "server-only";

import { getTelegramBotToken } from "./env";

/**
 * Минимальный клиент Telegram Bot API: только sendMessage.
 *
 * Никаких SDK, polling и состояний — обычный server-side fetch.
 * Модуль помечен `server-only`, поэтому токен физически не может попасть
 * в клиентский бандл.
 */

const DEFAULT_API_BASE = "https://api.telegram.org";

/**
 * Базовый адрес Bot API. Переопределяется только для локальной проверки
 * (`TELEGRAM_API_BASE`), в production переменная не задаётся.
 */
function apiBase(): string {
  return process.env.TELEGRAM_API_BASE?.trim() || DEFAULT_API_BASE;
}

/** Приветствие на команду /start. */
export const START_MESSAGE_TEXT =
  "Привет! Твои задания уже ждут тебя, нажимай кнопку внизу «Открыть», выполняй их и зарабатывай реальные деньги!";

/** Подпись единственной кнопки в приветственном сообщении. */
export const OPEN_BUTTON_TEXT = "Открыть";

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: { url: string };
}

export interface TelegramReplyMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/** Клавиатура с одной кнопкой «Открыть», которая открывает существующий Mini App. */
export function buildOpenMiniAppKeyboard(appUrl: string): TelegramReplyMarkup {
  return { inline_keyboard: [[{ text: OPEN_BUTTON_TEXT, web_app: { url: appUrl } }]] };
}

/** Убирает токен из строки, чтобы он никогда не попал в логи. */
function redact(value: string): string {
  const token = getTelegramBotToken();
  return token ? value.split(token).join("***") : value;
}

export interface TelegramSendResult {
  ok: boolean;
  /** Безопасное (без токена и без URL с токеном) описание ошибки для server log. */
  error?: string;
  errorCode?: number;
}

interface TelegramApiResponse {
  ok?: boolean;
  error_code?: number;
  description?: string;
}

/**
 * sendMessage: отправляет текст в чат, при необходимости с inline-клавиатурой.
 *
 * Никогда не бросает исключение, никогда не раскрывает токен: наружу уходит только
 * `error_code` и текст от Telegram (предварительно очищенный от токена).
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<TelegramSendResult> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }
  if (!Number.isInteger(chatId)) {
    return { ok: false, error: "Некорректный chat_id" };
  }

  try {
    const response = await fetch(`${apiBase()}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;

    if (!response.ok || !payload?.ok) {
      const errorCode = payload?.error_code ?? response.status;
      return {
        ok: false,
        errorCode,
        error: redact(payload?.description ?? `HTTP ${response.status}`),
      };
    }

    return { ok: true };
  } catch (error) {
    // Сетевая ошибка может содержать URL с токеном — логируем только её тип.
    return { ok: false, error: `network error (${error instanceof Error ? error.name : "unknown"})` };
  }
}
