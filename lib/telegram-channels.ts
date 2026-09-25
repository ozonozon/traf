import "server-only";

import { getTelegramBotToken } from "./env";
import { TELEGRAM_CHANNELS, hasUnconfiguredChannels, type TelegramChannelConfig } from "@/config/telegram-channels";

/**
 * Проверка подписок на Telegram-каналы через Bot API.
 *
 * Решение о выполнении задания принимает ТОЛЬКО backend: frontend не может заявить
 * «я подписался» и получить награду. Bot token живёт только здесь (server-only модуль).
 */

export type ChannelMembershipStatus = "joined" | "not_joined" | "not_configured" | "error";

export interface ChannelMembershipResult {
  channelId: string;
  status: ChannelMembershipStatus;
  /** Текст ошибки от Telegram API (для статуса error). */
  message?: string;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

function botToken(): string {
  return getTelegramBotToken();
}

/** Telegram id реального пользователя (у локального демо-пользователя id строковый). */
export function isNumericTelegramId(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\d{3,}$/.test(value);
}

interface GetChatMemberResponse {
  ok: boolean;
  error_code?: number;
  description?: string;
  result?: {
    status?: string;
    is_member?: boolean;
  };
}

/**
 * getChatMember для одного канала.
 * Подписан: creator / administrator / member, а также restricted с is_member = true.
 * Не подписан: left / kicked.
 */
export async function checkChannelMembership(
  telegramUserId: string,
  channel: TelegramChannelConfig,
): Promise<ChannelMembershipResult> {
  if (!channel.chatId) {
    return { channelId: channel.id, status: "not_configured", message: "chat_id канала не задан" };
  }

  const token = botToken();
  if (!token) {
    return { channelId: channel.id, status: "error", message: "TELEGRAM_BOT_TOKEN не настроен" };
  }

  const url =
    `${TELEGRAM_API_BASE}/bot${token}/getChatMember` +
    `?chat_id=${encodeURIComponent(channel.chatId)}&user_id=${encodeURIComponent(telegramUserId)}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as GetChatMemberResponse;

    if (!payload.ok) {
      return {
        channelId: channel.id,
        status: "error",
        message: payload.description ?? `Telegram API вернул ошибку ${payload.error_code ?? ""}`.trim(),
      };
    }

    const status = payload.result?.status;

    if (status === "creator" || status === "administrator" || status === "member") {
      return { channelId: channel.id, status: "joined" };
    }
    if (status === "restricted") {
      // restricted + is_member=true — пользователь остаётся участником канала.
      return payload.result?.is_member === true
        ? { channelId: channel.id, status: "joined" }
        : { channelId: channel.id, status: "not_joined" };
    }

    // left / kicked и любые неизвестные статусы — считаем неподтверждённой подпиской.
    return { channelId: channel.id, status: "not_joined" };
  } catch (error) {
    return {
      channelId: channel.id,
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось обратиться к Telegram API",
    };
  }
}

/** Проверка всех каналов задания. */
export async function checkChannelsMembership(
  telegramUserId: string,
  channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS,
): Promise<ChannelMembershipResult[]> {
  return Promise.all(channels.map((channel) => checkChannelMembership(telegramUserId, channel)));
}

export { hasUnconfiguredChannels };
