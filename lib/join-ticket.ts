import "server-only";

import crypto from "node:crypto";

import { getAuthSecret } from "./env";
import type { TelegramChannelIndex } from "@/config/telegram-channels";

/**
 * Подписанный тикет заявки на вступление в канал.
 *
 * Зачем он нужен: Telegram присылает `chat_join_request` нашему webhook — это запрос
 * от серверов Telegram, без cookie пользователя. Записать в подписанное состояние
 * (httpOnly-cookie) можно только из запроса самого пользователя, поэтому webhook
 * выпускает такой тикет и отдаёт его пользователю кнопкой в боте. Приложение при
 * следующем открытии отправляет тикет на сервер, сервер проверяет подпись и только
 * тогда выставляет channelNRequested = true.
 *
 * Тикет невозможно подделать: подпись HMAC-SHA256 на AUTH_SECRET, привязана к
 * telegram-id пользователя и номеру канала, срок действия ограничен.
 */

const TICKET_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface JoinTicketPayload {
  /** Telegram id пользователя, от которого пришла заявка. */
  uid: string;
  channel: TelegramChannelIndex;
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

/** Выпускает тикет для конкретного пользователя и канала. */
export function createJoinTicket(telegramUserId: string | number, channel: TelegramChannelIndex): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: String(telegramUserId),
      channel,
      exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
    }),
    "utf8",
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

/** Проверяет подпись и срок действия тикета. Возвращает null, если тикет недействителен. */
export function verifyJoinTicket(token: string | null | undefined): JoinTicketPayload | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<JoinTicketPayload>;
    const channel = parsed.channel;
    if (!parsed.uid) return null;
    if (channel !== 1 && channel !== 2 && channel !== 3) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: parsed.uid, channel, exp: parsed.exp };
  } catch {
    return null;
  }
}
