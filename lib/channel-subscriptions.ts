import "server-only";

import { TELEGRAM_CHANNELS } from "@/config/telegram-channels";

import { RouteError } from "./http";
import { getChatMemberStatus } from "./telegram-bot";
import type { ChannelSubscriptionDto } from "./types";

/**
 * Проверка ФАКТИЧЕСКОЙ подписки пользователя на обязательные Telegram-каналы.
 *
 * Единственный источник правды — Telegram Bot API `getChatMember` для каждого канала
 * из config/telegram-channels.ts. Никаких тикетов и сохранённых состояний:
 * результат проверки нигде не кэшируется.
 *
 * Если Telegram ответил ошибкой — канал НЕ считается подписанным.
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
  // Каждый канал проверяется СВОИМ chatId (config/telegram-channels.ts), и результат сразу
  // помечается идентификатором этого же канала (id/index). Сопоставления «результат ↔ канал»
  // по позиции массива нет, поэтому рассинхрон каналов невозможен.
  // Пустой chatId — ошибка настройки: канал считается непроверенным (CHAT_ID_MISSING в lib/telegram-bot.ts).
  const pairs = await Promise.all(
    TELEGRAM_CHANNELS.map(async (channel) => ({
      channel,
      check: await getChatMemberStatus(channel.chatId, telegramId),
    })),
  );

  const failed: string[] = [];
  const result: ChannelSubscriptionDto[] = pairs
    .map(({ channel, check }) => {
      if (check.error && check.error !== "USER_NOT_FOUND") failed.push(channel.id);

      return {
        id: channel.id,
        index: channel.index,
        title: channel.title,
        description: channel.description,
        inviteLink: channel.inviteLink,
        subscribed: check.subscribed,
      };
    })
    // Порядок отображения — по index канала (1 → 2 → 3), а не по порядку запросов в Telegram.
    .sort((left, right) => left.index - right.index);

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
