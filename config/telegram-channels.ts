/**
 * Конфигурация Telegram-каналов для задания «Подписка на Telegram-каналы».
 *
 * ЭТО ЕДИНСТВЕННОЕ МЕСТО, где нужно менять каналы.
 *
 *  - `url`    — ссылка, которую открывает пользователь (обычная или инвайт-ссылка t.me/+hash);
 *  - `chatId` — идентификатор канала для Bot API `getChatMember`: публичный @username
 *               или числовой id вида -1001234567890.
 *
 * ⚠️ Пока `chatId = null` (не настроено), backend НЕ обращается к Telegram API и возвращает
 * понятное состояние «Каналы ещё не настроены.», задание не засчитывается.
 * После подстановки реальных `url` и `chatId` проверка заработает без изменений frontend.
 */

export interface TelegramChannelConfig {
  id: string;
  title: string;
  username: string;
  url: string;
  /** @username канала или числовой chat id. null — канал ещё не настроен. */
  chatId: string | null;
}

/** Публичное представление канала для API (без служебных полей). */
export interface TelegramChannelPublic {
  id: string;
  title: string;
  username: string;
  url: string;
}

export const TELEGRAM_CHANNELS: TelegramChannelConfig[] = [
  {
    id: "channel_1",
    title: "Канал 1",
    username: "@channel_1",
    url: "https://t.me/channel_1",
    chatId: null,
  },
  {
    id: "channel_2",
    title: "Канал 2",
    username: "@channel_2",
    url: "https://t.me/channel_2",
    chatId: null,
  },
  {
    id: "channel_3",
    title: "Канал 3",
    username: "@channel_3",
    url: "https://t.me/channel_3",
    chatId: null,
  },
];

/** Каналы без служебных полей — уходят на фронтенд. */
export function publicChannels(channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS): TelegramChannelPublic[] {
  return channels.map(({ id, title, username, url }) => ({ id, title, username, url }));
}

/** true, если хотя бы у одного канала не заполнен chatId. */
export function hasUnconfiguredChannels(channels: TelegramChannelConfig[] = TELEGRAM_CHANNELS): boolean {
  return channels.some((channel) => !channel.chatId);
}

/** Количество каналов, на которые нужно подписаться. */
export const TELEGRAM_CHANNELS_COUNT = TELEGRAM_CHANNELS.length;
