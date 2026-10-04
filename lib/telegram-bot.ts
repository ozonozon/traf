import "server-only";

import { getTelegramBotToken } from "./env";

/**
 * Клиент Telegram Bot API для проверки подписки.
 *
 * Токен живёт только здесь (server-only, `lib/env.ts`) и никогда не уходит клиенту.
 * Технические ответы Telegram наружу не отдаются: наружу идут только понятные коды.
 */

/** Статусы getChatMember, которые считаются подпиской. */
const SUBSCRIBED_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

export type ChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked"
  | "unknown";

/** Понятная причина неудачной проверки (без технического ответа Telegram). */
export type ChatMemberError =
  | "CHAT_ID_MISSING"
  | "CHAT_NOT_FOUND"
  | "BOT_NOT_IN_CHANNEL"
  | "USER_NOT_FOUND"
  | "TELEGRAM_UNAVAILABLE";

export interface ChatMemberCheck {
  /** Подписка подтверждена Telegram. При любой ошибке — false. */
  subscribed: boolean;
  status: ChatMemberStatus;
  error: ChatMemberError | null;
}

/** Тело ответа Telegram Bot API (нужны только result.status и описание ошибки). */
interface TelegramResponse {
  ok?: boolean;
  description?: string;
  result?: { status?: string };
}

/** Превращает текст ошибки Telegram в понятный код. */
function toErrorCode(description: string): ChatMemberError {
  const text = description.toLowerCase();

  if (text.includes("chat not found")) return "CHAT_NOT_FOUND";
  if (
    text.includes("bot is not a member") ||
    text.includes("not enough rights") ||
    text.includes("member list is inaccessible") ||
    text.includes("chat_admin_required") ||
    text.includes("have no rights") ||
    text.includes("not enough rights to get chat member")
  ) {
    return "BOT_NOT_IN_CHANNEL";
  }
  if (text.includes("user not found") || text.includes("participant not found")) return "USER_NOT_FOUND";

  return "TELEGRAM_UNAVAILABLE";
}

/**
 * Проверяет подписку пользователя на канал через Bot API `getChatMember`.
 *
 * @param chatId `-100…` или `@username` канала (из config/telegram-channels.ts)
 * @param userId telegram_id пользователя (берётся только из серверной авторизации)
 */
export async function getChatMemberStatus(chatId: string, userId: string): Promise<ChatMemberCheck> {
  if (!chatId.trim()) {
    return { subscribed: false, status: "unknown", error: "CHAT_ID_MISSING" };
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return { subscribed: false, status: "unknown", error: "TELEGRAM_UNAVAILABLE" };
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
      cache: "no-store",
    });
  } catch {
    return { subscribed: false, status: "unknown", error: "TELEGRAM_UNAVAILABLE" };
  }

  let payload: TelegramResponse | null = null;
  try {
    payload = (await response.json()) as TelegramResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const error = toErrorCode(payload?.description ?? "");
    return { subscribed: false, status: "unknown", error };
  }

  const status = (payload.result?.status ?? "unknown") as ChatMemberStatus;

  return {
    subscribed: SUBSCRIBED_STATUSES.has(status),
    status,
    error: status === "unknown" ? "TELEGRAM_UNAVAILABLE" : null,
  };
}

/** Текст кнопки «Открыть» — тот же, что в приветственном сообщении /start. */
export const OPEN_APP_BUTTON_TEXT = "Открыть";

/** Результат отправки сообщения пользователю. */
export type BotMessageOutcome = "sent" | "blocked" | "transient";

/**
 * Отправляет пользователю сообщение с кнопкой-ссылкой на Mini App (`web_app`).
 *
 * Ограничения Telegram, которые здесь учтены:
 *  - бот может писать только тем, кто сам начал с ним диалог (эту цепочку мы ставим
 *    исключительно по /start, поэтому других получателей не бывает);
 *  - кнопка `web_app` допустима только в личном чате и требует абсолютный HTTPS-URL;
 *  - если пользователь заблокировал бота (403) — это НЕ временная ошибка: повторять нельзя.
 */
export async function sendMiniAppMessage(
  chatId: string | number,
  text: string,
  appUrl: string,
): Promise<{ outcome: BotMessageOutcome; details?: string }> {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return { outcome: "transient", details: "TELEGRAM_BOT_TOKEN не настроен" };
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: OPEN_APP_BUTTON_TEXT, web_app: { url: appUrl } }]],
        },
      }),
    });
  } catch {
    return { outcome: "transient", details: "Telegram API недоступен" };
  }

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (response.ok && payload?.ok) return { outcome: "sent" };

  const description = payload?.description ?? `HTTP ${response.status}`;
  return { outcome: isPermanentSendFailure(description) ? "blocked" : "transient", details: description };
}

/** Причины, по которым повторные попытки бессмысленны (бот не может писать пользователю). */
function isPermanentSendFailure(description: string): boolean {
  const text = description.toLowerCase();
  return (
    text.includes("bot was blocked") ||
    text.includes("user is deactivated") ||
    text.includes("bot was kicked") ||
    text.includes("chat not found") ||
    text.includes("peer_id_invalid") ||
    text.includes("bot can't initiate conversation") ||
    text.includes("bot is not a member")
  );
}

