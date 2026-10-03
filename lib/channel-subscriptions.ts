import "server-only";

import { CHANNEL_CHECK_MODE, orderedChannels } from "@/config/telegram-channels";

import { getRequestedChannelIds } from "./db";
import { RouteError } from "./http";
import { getChatMemberStatus } from "./telegram-bot";
import type { ChannelCheckMode, ChannelSubscriptionDto } from "./types";

/**
 * Проверка обязательного задания.
 *
 * Режим задаётся одним переключателем CHANNEL_CHECK_MODE в config/telegram-channels.ts:
 *
 *  - "subscription" (РАБОЧИЙ) — единственный источник правды Telegram Bot API `getChatMember`
 *    для каждого канала. Если Telegram ответил ошибкой — канал НЕ считается подписанным.
 *    Результат нигде не кэшируется, никаких заявок (chat_join_request) не читается.
 *
 *  - "join_request" (ЭКСПЕРИМЕНТ) — считаем отправленную заявку на вступление: читаем
 *    таблицу channel_requests, куда заявки попадают ТОЛЬКО из update chat_join_request
 *    от Telegram (app/api/telegram/webhook/route.ts). getChatMember не вызывается.
 *    Старая механика при этом остаётся в коде и включается обратно одним значением флага.
 */
export interface SubscriptionCheck {
  channels: ChannelSubscriptionDto[];
  subscribedCount: number;
  total: number;
  allSubscribed: boolean;
  /** Каналы, которые не удалось проверить (нет chatId, бот не в канале, сбой Telegram). */
  failed: string[];
  /** Активный режим проверки — уходит в API, чтобы UI показал корректные подписи. */
  mode: ChannelCheckMode;
}

/** Экспериментальная ветка: заявка на вступление вместо подписки. */
async function checkJoinRequests(
  telegramId: string,
  channels: ReturnType<typeof orderedChannels>,
): Promise<SubscriptionCheck> {
  const requestedChannelIds = await getRequestedChannelIds(telegramId);
  const result = buildResult(channels, (channel) => requestedChannelIds.includes(channel.id));

  return { ...result, failed: [], mode: CHANNEL_CHECK_MODE };
}

/** Рабочая ветка: фактическая подписка через Telegram Bot API getChatMember. */
async function checkRealSubscriptions(
  telegramId: string,
  channels: ReturnType<typeof orderedChannels>,
): Promise<SubscriptionCheck> {
  // chat_id для getChatMember берётся только из серверного конфига (config/telegram-channels.ts).
  // Пустой chatId — ошибка настройки: канал считается непроверенным (CHAT_ID_MISSING в lib/telegram-bot.ts).
  const checks = await Promise.all(
    channels.map((channel) => getChatMemberStatus(channel.chatId, telegramId)),
  );

  const failed: string[] = [];
  const result = buildResult(channels, (channel, position) => {
    const check = checks[position];
    if (check.error && check.error !== "USER_NOT_FOUND") failed.push(channel.id);
    return check.subscribed;
  });

  return { ...result, failed, mode: CHANNEL_CHECK_MODE };
}

function buildResult(
  channels: ReturnType<typeof orderedChannels>,
  resolve: (channel: ReturnType<typeof orderedChannels>[number], position: number) => boolean,
): Omit<SubscriptionCheck, "failed" | "mode"> {
  const result: ChannelSubscriptionDto[] = channels.map((channel, position) => ({
    id: channel.id,
    index: channel.index,
    title: channel.title,
    description: channel.description,
    inviteLink: channel.inviteLink,
    subscribed: resolve(channel, position),
  }));

  const subscribedCount = result.filter((channel) => channel.subscribed).length;

  return {
    channels: result,
    subscribedCount,
    total: result.length,
    allSubscribed: result.length > 0 && subscribedCount === result.length,
  };
}

export async function checkChannelSubscriptions(telegramId: string): Promise<SubscriptionCheck> {
  // Один упорядоченный список (порядок задаёт index в конфиге) — и для проверки, и для ответа.
  const channels = orderedChannels();

  return CHANNEL_CHECK_MODE === "join_request"
    ? checkJoinRequests(telegramId, channels)
    : checkRealSubscriptions(telegramId, channels);
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
