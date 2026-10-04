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
 *
 * ⚠️ ИНВАРИАНТ: `chatId` и `inviteLink` одной карточки обязаны указывать на ОДИН И ТОТ ЖЕ
 * канал. Пользователь подписывается по `inviteLink`, а сервер проверяет `chatId` — если они
 * разъедутся, после подписки по карточке №1 подтвердится карточка №2 (и наоборот).
 * Как проверить: название канала из `getChat(chatId)` должно совпадать с названием, которое
 * отдаёт страница invite-ссылки (`https://t.me/+hash` → `og:title`).
 * Реальные каналы этого конфига: 1 — «ВСЕ О СПОРТЕ», 2 — «СПЛЕТНИ ЗВЕЗД», 3 — «НОВОСТИ КАЖДЫЙ ДЕНЬ».
 */

/** Номер канала: совпадает с полями channel1Subscribed…channel3Subscribed в состоянии. */
export type TelegramChannelIndex = 1 | 2 | 3;

export interface TelegramChannelConfig {
  index: TelegramChannelIndex;
  /** Стабильный ключ карточки для интерфейса (не путать с `chatId` — по нему идёт проверка). */
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
    // Канал по этой invite-ссылке — «ВСЕ О СПОРТЕ» (проверено getChat).
    chatId: "-1003929038199",
  },
  {
    index: 2,
    id: "-1003929038199",
    title: "Канал с выплатами",
    description: "Новости платформы и розыгрыши",
    inviteLink: "https://t.me/+nJs69Y_Xpm5hMDU5",
    // Канал по этой invite-ссылке — «СПЛЕТНИ ЗВЕЗД» (проверено getChat).
    chatId: "-1004218822912",
  },
  {
    index: 3,
    id: "-1004398133122",
    title: "Канал поддержки",
    description: "Ответы на вопросы и помощь",
    inviteLink: "https://t.me/+0o4yDY6AODI3OTQx",
    // Канал по этой invite-ссылке — «НОВОСТИ КАЖДЫЙ ДЕНЬ» (проверено getChat).
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

