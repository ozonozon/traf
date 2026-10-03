/**
 * Каналы обязательного задания «Подписка на Telegram-каналы».
 *
 * ЭТО ЕДИНСТВЕННОЕ МЕСТО, где задаются каналы и их идентификаторы.
 *
 * Подписка проверяется сервером через Telegram Bot API `getChatMember`:
 *   chat_id = chatId канала, user_id = telegram_id авторизованного пользователя.
 *
 * `chatId` — обязательный параметр проверки: числовой id канала (`-1001234567890`)
 * либо публичный `@username`. Бот (@BotFather) должен быть добавлен в каждый канал;
 * для приватных каналов и каналов без публичного username — обязательно администратором,
 * иначе Telegram отвечает «chat not found» и проверка вернёт понятную ошибку.
 */

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

/** Каналы для фронтенда: только то, что нужно интерфейсу (chatId не уходит клиенту). */
export function publicChannels(channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS): TelegramChannelPublic[] {
  return channels.map(({ index, id, title, description, inviteLink }) => ({
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

