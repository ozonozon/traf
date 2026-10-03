import "server-only";

import { TELEGRAM_CHANNELS, publicChannels } from "@/config/telegram-channels";

import { RouteError } from "./http";
import { getChatMemberStatus } from "./telegram-bot";
import type { ChannelSubscriptionDto } from "./types";

/**
 * Проверка ФАКТИЧЕСКОЙ подписки пользователя на обязательные Telegram-каналы.
 *
 * Единственный источник правды — Telegram Bot API `getChatMember` для каждого канала
 * из config/telegram-channels.ts. Никаких заявок (chat_join_request), тикетов и
 * сохранённых состояний: результат проверки нигде не кэшируется.
 *
 * if Telegram ответил ошибкой — канал НЕ считается подписанным.
 */
export interface SubscriptionCheck {
  channels: ChannelSubscriptionDto[];
  subscribedCount: number;
  total: number;
  allSubscribed: boolean;
  /** Каналы, которые не удалось проверить (нет chatId, бот не в канале, сбой Telegram). */
  failed: string[];
}

export async function checkChannelSubscriptions(telegramId: string): Promise<SubscriptionCheck> {
  const channels = publicChannels();

  // chat_id для getChatMember берётся только из серверного конфига (config/telegram-channels.ts).
  // Пустой chatId — ошибка настройки: канал считается непроверенным (CHAT_ID_MISSING в lib/telegram-bot.ts).
  const checks = await Promise.all(
    TELEGRAM_CHANNELS.map((channel) => getChatMemberStatus(channel.chatId, telegramId)),
  );

  const failed: string[] = [];
  const result: ChannelSubscriptionDto[] = channels.map((channel, position) => {
    const check = checks[position];
    if (check.error && check.error !== "USER_NOT_FOUND") failed.push(channel.id);

    return {
      id: channel.id,
      index: channel.index,
      title: channel.title,
      description: channel.description,
      inviteLink: channel.inviteLink,
      subscribed: check.subscribed,
    };
  });

  const subscribedCount = result.filter((channel) => channel.subscribed).length;

  return {
    channels: result,
    subscribedCount,
    total: result.length,
    allSubscribed: result.length > 0 && subscribedCount === result.length,
    failed,
  };
}

/**
 * Если ни один канал проверить не удалось (нет chatId в конфиге, бот не добавлен
 * в каналы, Telegram недоступен) — это ошибка настройки, а не «нет подписки».
 */
export function assertChannelsCheckable(check: SubscriptionCheck): void {
  if (check.total > 0 && check.failed.length === check.total) {
    console.error(`[channels] проверка подписки невозможна: не удалось проверить каналы ${check.failed.join(", ")}`);
    throw new RouteError(
      "TELEGRAM_CHANNEL_CHECK_FAILED",
      "Не удалось проверить подписку на каналы. Попробуйте позже или сообщите в поддержку.",
      503,
    );
  }
}

/** Проверка для защиты награды: все обязательные подписки должны быть подтверждены. */
export async function isSubscribedToAllChannels(telegramId: string): Promise<boolean> {
  const check = await checkChannelSubscriptions(telegramId);
  assertChannelsCheckable(check);
  return check.allSubscribed;
}
