import "server-only";

import { getTelegramBotToken } from "./env";

/**
 * Клиент Telegram Bot API для проверки подписки.
 *
 * Токен живёт только здесь (server-only, `lib/env.ts`) и никогда не уходит клиенту.
 * Технические ответы Telegram наружу не отдаются: наружу идут только понятные коды.
 */

/** Публичные данные бота (getMe): нужны только для диагностики, токен не раскрывается. */
export interface BotIdentity {
  tokenConfigured: boolean;
  tokenValid: boolean;
  username: string | null;
  botId: number | null;
  firstName: string | null;
  error: string | null;
}

/**
 * `GET /getMe` — проверка, что TELEGRAM_BOT_TOKEN вообще от Telegram и какому боту он принадлежит.
 * Возвращаются только публичные поля (username/id/имя), сам токен наружу не отдаётся.
 */
export async function getBotIdentity(): Promise<BotIdentity> {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return { tokenConfigured: false, tokenValid: false, username: null, botId: null, firstName: null, error: "TOKEN_MISSING" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: "no-store" });
    const payload = (await response.json()) as {
      ok?: boolean;
      description?: string;
      result?: { id?: number; username?: string; first_name?: string };
    };

    if (!response.ok || !payload.ok) {
      return {
        tokenConfigured: true,
        tokenValid: false,
        username: null,
        botId: null,
        firstName: null,
        error: toErrorCode(payload.description ?? ""),
      };
    }

    return {
      tokenConfigured: true,
      tokenValid: true,
      username: payload.result?.username ?? null,
      botId: payload.result?.id ?? null,
      firstName: payload.result?.first_name ?? null,
      error: null,
    };
  } catch {
    return { tokenConfigured: true, tokenValid: false, username: null, botId: null, firstName: null, error: "TELEGRAM_UNAVAILABLE" };
  }
}

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
