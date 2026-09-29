/**
 * Каналы задания «Подписка на Telegram-каналы».
 *
 * ЭТО ЕДИНСТВЕННОЕ МЕСТО, где меняются ссылки и сопоставление заявок.
 *
 * Заявки (`chat_join_request`) Telegram присылает нашему webhook. Заявка определяется
 * по `invite_link.invite_link` (та самая постоянная ссылка, которую использовал
 * пользователь) — отдельные ссылки для пользователей не создаются. Если у канала
 * дополнительно известен `chatId`, он используется как второй признак.
 */

/** Номер канала: совпадает с полями channel1Requested…channel3Requested в состоянии. */
export type TelegramChannelIndex = 1 | 2 | 3;

export interface TelegramChannelConfig {
  index: TelegramChannelIndex;
  id: string;
  /** Название канала для карточки задания. */
  title: string;
  /** Короткое описание для карточки задания. */
  description: string;
  /** Постоянная invite-ссылка канала — её открывает кнопка «Подписаться». */
  url: string;
  /** Необязательный id канала (например, -1001234567890) как второй признак заявки. */
  chatId: string | null;
}

/** Данные канала для фронтенда: только то, что нужно интерфейсу. */
export interface TelegramChannelPublic {
  index: TelegramChannelIndex;
  id: string;
  title: string;
  description: string;
  url: string;
}

export const TELEGRAM_CHANNELS: TelegramChannelConfig[] = [
  {
    index: 1,
    id: "channel_1",
    title: "Канал с заданиями",
    description: "Новые задания и выплаты каждый день",
    url: "https://t.me/+MWJ1dz5nuf4zMjcx",
    chatId: null,
  },
  {
    index: 2,
    id: "channel_2",
    title: "Канал с выплатами",
    description: "Новости платформы и розыгрыши",
    url: "https://t.me/+nJs69Y_Xpm5hMDU5",
    chatId: null,
  },
  {
    index: 3,
    id: "channel_3",
    title: "Канал поддержки",
    description: "Ответы на вопросы и помощь",
    url: "https://t.me/+0o4yDY6AODI3OTQx",
    chatId: null,
  },
];

/** Каналы для фронтенда. */
export function publicChannels(channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS): TelegramChannelPublic[] {
  return channels.map(({ index, id, title, description, url }) => ({ index, id, title, description, url }));
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
 * Определяет канал по данным заявки из Telegram.
 * Сначала — по invite-ссылке (её присылает сам Telegram), затем — по chatId, если он задан.
 */
export function findChannelByInvite(
  inviteLink?: string | null,
  chatId?: number | string | null,
): TelegramChannelConfig | null {
  if (inviteLink) {
    const normalized = normalizeInvite(inviteLink);
    const byLink = TELEGRAM_CHANNELS.find((channel) => normalizeInvite(channel.url) === normalized);
    if (byLink) return byLink;
  }

  if (chatId !== undefined && chatId !== null) {
    const idText = String(chatId);
    return TELEGRAM_CHANNELS.find((channel) => channel.chatId !== null && String(channel.chatId) === idText) ?? null;
  }

  return null;
}

