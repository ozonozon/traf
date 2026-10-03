/**
 * Каналы обязательного задания «Подписка на Telegram-каналы».
 *
 * ЭТО ЕДИНСТВЕННОЕ МЕСТО, где задаются каналы, их идентификаторы И ИХ ПОРЯДОК.
 *
 * Порядок в задании задаёт только поле `index` (1 → 2 → 3). Массив ниже уже отсортирован,
 * но API берёт каналы через `orderedChannels()` и сортирует их по `index`, а интерфейс
 * не сортирует каналы сам — он рисует список в том порядке, в котором он пришёл с сервера.
 * Поэтому менять порядок нужно здесь, а не в компонентах.
 *
 * Подписка проверяется сервером через Telegram Bot API `getChatMember`:
 *   chat_id = chatId канала, user_id = telegram_id авторизованного пользователя.
 *
 * `chatId` — обязательный параметр проверки: числовой id канала (`-1001234567890`)
 * либо публичный `@username`. Бот (@BotFather) должен быть добавлен в каждый канал;
 * для приватных каналов и каналов без публичного username — обязательно администратором,
 * иначе Telegram отвечает «chat not found» и проверка вернёт понятную ошибку.
 */

import type { ChannelCheckMode } from "@/lib/types";

/** Номер канала: совпадает с полями channel1Subscribed…channel3Subscribed в состоянии. */
export type TelegramChannelIndex = 1 | 2 | 3;

export interface TelegramChannelConfig {
  index: TelegramChannelIndex;
  id: string;
  /** Название канала для карточки задания. */
  title: string;
  /** Короткое описание для карточки задания. */
  description: string;
  /** Постоянная invite-ссылка канала — её открывает кнопка «ПОДПИСАТЬСЯ». */
  inviteLink: string;
  /** chat_id для getChatMember: `-100…` или `@username`. */
  chatId: string;
}

/** Данные канала для фронтенда: без chatId — он нужен только серверу. */
export interface TelegramChannelPublic {
  index: TelegramChannelIndex;
  id: string;
  title: string;
  description: string;
  inviteLink: string;
}

export const TELEGRAM_CHANNELS: TelegramChannelConfig[] = [
  {
    index: 1,
    id: "-1004218822912",
    title: "Канал с заданиями",
    description: "Новые задания и выплаты каждый день",
    inviteLink: "https://t.me/+MWJ1dz5nuf4zMjcx",
    chatId: "-1004218822912",
  },
  {
    index: 2,
    id: "-1003929038199",
    title: "Канал с выплатами",
    description: "Новости платформы и розыгрыши",
    inviteLink: "https://t.me/+nJs69Y_Xpm5hMDU5",
    chatId: "-1003929038199",
  },
  {
    index: 3,
    id: "-1004398133122",
    title: "Канал поддержки",
    description: "Ответы на вопросы и помощь",
    inviteLink: "https://t.me/+0o4yDY6AODI3OTQx",
    chatId: "-1004398133122",
  },
];

/**
 * РЕЖИМ проверки обязательного задания (один переключатель, меняется только здесь):
 *
 *  - "subscription" — текущая РАБОЧАЯ механика: сервер вызывает Telegram Bot API
 *                     getChatMember и считает подпиской member / administrator /
 *                     creator / restricted.
 *
 *  - "join_request" — ЭКСПЕРИМЕНТ: считаем не подписку, а отправленную заявку на вступление
 *                     в закрытый канал. Telegram присылает нашему webhook update
 *                     chat_join_request, он пишется в таблицу channel_requests
 *                     (см. app/api/telegram/webhook/route.ts), а Mini App читает её через
 *                     /api/channel-subscriptions. getChatMember в этом режиме не вызывается.
 *
 * Механики не смешиваются: в один момент времени работает ровно одна.
 */
export const CHANNEL_CHECK_MODE: ChannelCheckMode = "subscription";

/** Режим проверки (для типов API/UI). */
export type { ChannelCheckMode };

/**
 * ЕДИНСТВЕННЫЙ источник порядка каналов: поле `index` (1 → 2 → 3).
 * API и UI обязаны использовать этот порядок и не сортировать каналы по-своему.
 */
export function orderedChannels(
  channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS,
): TelegramChannelConfig[] {
  return [...channels].sort((left, right) => left.index - right.index);
}

/** Каналы для фронтенда: только то, что нужно интерфейсу (chatId не уходит клиенту). */
export function publicChannels(channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS): TelegramChannelPublic[] {
  return orderedChannels(channels).map(({ index, id, title, description, inviteLink }) => ({
    index,
    id,
    title,
    description,
    inviteLink,
  }));
}

/** Приводит ссылку к сравнимому виду: без схемы, домена, ведущего «+» и слэшей. */
function normalizeInvite(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^t\.me\//, "")
    .replace(/^\+/, "")
    .replace(/\/+$/, "");
}

/**
 * Определяет канал по данным заявки из Telegram (legacy chat_join_request).
 * Оставлено для обратной совместимости webhook; новая проверка подписки
 * (getChatMember) использует `chatId` из этого же конфига.
 */
export function findChannelByInvite(
  inviteLink?: string | null,
  chatId?: number | string | null,
): TelegramChannelConfig | null {
  if (inviteLink) {
    const normalized = normalizeInvite(inviteLink);
    const byLink = TELEGRAM_CHANNELS.find((channel) => normalizeInvite(channel.inviteLink) === normalized);
    if (byLink) return byLink;
  }

  if (chatId !== undefined && chatId !== null) {
    const idText = String(chatId);
    return TELEGRAM_CHANNELS.find((channel) => channel.chatId !== "" && String(channel.chatId) === idText) ?? null;
  }

  return null;
}

