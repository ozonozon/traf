import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";

import { getAuthSecret, isProduction } from "./env";
import type { TelegramUser } from "./telegram";
import type { PublicUserDto, TransactionDto } from "./types";

/**
 * Хранилище состояния пользователя для MVP — подписанная httpOnly-cookie.
 *
 * Честно о границах: это НЕ постоянная база данных. Состояние живёт в браузере
 * пользователя, подписано на сервере (HMAC-SHA256) и не синхронизируется между
 * устройствами. Такой подход выбран осознанно, чтобы MVP работал на Vercel без
 * внешней БД и без обязательного DATABASE_URL.
 *
 * Что важно: подпись проверяется на каждом запросе, поэтому клиент не может
 * подделать баланс, награду или количество выполненных заданий — все суммы
 * по-прежнему считает сервер и берёт reward из определения задания.
 */

export const STATE_COOKIE = "voxy_state";
const STATE_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Ограничения, чтобы cookie не превысила лимит браузера (4 КБ). */
const MAX_SUBMISSIONS = 10;
const MAX_TRANSACTIONS = 20;
const MAX_STORED_ANSWER = 400;

export const DEMO_TELEGRAM_ID = "demo_user";
export const DEMO_BALANCE = 360;

export interface StoredSubmission {
  taskId: string;
  answer: string;
  rating: number | null;
  selectedOptionId: string | null;
  reward: number;
  createdAt: string;
}

export interface StoredTransaction {
  id: string;
  amount: number;
  type: "EARN" | "SPEND";
  description: string;
  createdAt: string;
}

export interface UserState {
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  totalEarned: number;
  completedTasks: number;
  isDemo: boolean;
  submissions: StoredSubmission[];
  transactions: StoredTransaction[];
}

// --- Подпись cookie ---------------------------------------------------------

function sign(payload: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function encodeState(state: UserState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeState(token: string | undefined): UserState | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<UserState>;
    if (!parsed || typeof parsed.telegramId !== "string" || typeof parsed.balance !== "number") return null;
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

/** Приводит любое (в т.ч. старое) состояние к корректному виду. */
function normalizeState(state: Partial<UserState>): UserState {
  return {
    telegramId: state.telegramId ?? "",
    username: state.username ?? null,
    firstName: state.firstName ?? "Пользователь",
    lastName: state.lastName ?? null,
    photoUrl: state.photoUrl ?? null,
    balance: Math.max(0, Math.trunc(state.balance ?? 0)),
    totalEarned: Math.max(0, Math.trunc(state.totalEarned ?? 0)),
    completedTasks: Math.max(0, Math.trunc(state.completedTasks ?? 0)),
    isDemo: Boolean(state.isDemo),
    submissions: Array.isArray(state.submissions) ? state.submissions.slice(0, MAX_SUBMISSIONS) : [],
    transactions: Array.isArray(state.transactions) ? state.transactions.slice(0, MAX_TRANSACTIONS) : [],
  };
}

// --- Создание состояния ----------------------------------------------------

/** Новое состояние по данным Telegram (баланс 0 — это новый пользователь). */
export function createTelegramState(telegramUser: TelegramUser): UserState {
  return {
    telegramId: String(telegramUser.id),
    username: telegramUser.username ?? null,
    firstName: telegramUser.first_name || "Пользователь",
    lastName: telegramUser.last_name ?? null,
    photoUrl: telegramUser.photo_url ?? null,
    balance: 0,
    totalEarned: 0,
    completedTasks: 0,
    isDemo: false,
    submissions: [],
    transactions: [],
  };
}

/** Демо-пользователь локальной разработки: стартовый виртуальный баланс 360 ₽. */
export function createDemoState(): UserState {
  return {
    telegramId: DEMO_TELEGRAM_ID,
    username: "demo_user",
    firstName: "Игорь",
    lastName: "Рябов",
    photoUrl: null,
    balance: DEMO_BALANCE,
    totalEarned: DEMO_BALANCE,
    completedTasks: 0,
    isDemo: true,
    submissions: [],
    transactions: [
      {
        id: "tx-welcome",
        amount: DEMO_BALANCE,
        type: "EARN",
        description: "Стартовый виртуальный баланс",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

/** Обновляет профиль из Telegram, сохраняя заработанное. */
export function refreshTelegramProfile(state: UserState, telegramUser: TelegramUser): UserState {
  return {
    ...state,
    telegramId: String(telegramUser.id),
    username: telegramUser.username ?? null,
    firstName: telegramUser.first_name || state.firstName,
    lastName: telegramUser.last_name ?? null,
    photoUrl: telegramUser.photo_url ?? null,
  };
}

// --- Чтение / запись cookie -------------------------------------------------

export async function readUserState(): Promise<UserState | null> {
  const store = await cookies();
  return decodeState(store.get(STATE_COOKIE)?.value);
}

export async function saveUserState(state: UserState): Promise<void> {
  const normalized = normalizeState(state);
  const store = await cookies();

  store.set(STATE_COOKIE, encodeState(normalized), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
}


// --- Операции с состоянием --------------------------------------------------

export function toPublicUser(state: UserState): PublicUserDto {
  return {
    username: state.username,
    firstName: state.firstName,
    lastName: state.lastName,
    photoUrl: state.photoUrl,
    balance: state.balance,
    totalEarned: state.totalEarned,
    completedTasks: state.completedTasks,
    isDemo: state.isDemo,
  };
}

export function findSubmission(state: UserState, taskId: string): StoredSubmission | null {
  return state.submissions.find((submission) => submission.taskId === taskId) ?? null;
}

export function hasCompleted(state: UserState, taskId: string): boolean {
  return findSubmission(state, taskId) !== null;
}

export function toTransactionDto(transaction: StoredTransaction): TransactionDto {
  return {
    id: transaction.id,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description,
    createdAt: transaction.createdAt,
  };
}

/**
 * Начисление виртуального вознаграждения за задание.
 * Всё считается на сервере: reward приходит из определения задания, а не из запроса.
 */
export function applySubmission(
  state: UserState,
  params: {
    taskId: string;
    taskTitle: string;
    reward: number;
    answer: string;
    rating: number | null;
    selectedOptionId: string | null;
  },
): { state: UserState; submission: StoredSubmission; transaction: StoredTransaction } {
  const now = new Date().toISOString();

  const submission: StoredSubmission = {
    taskId: params.taskId,
    answer: params.answer.slice(0, MAX_STORED_ANSWER),
    rating: params.rating,
    selectedOptionId: params.selectedOptionId,
    reward: params.reward,
    createdAt: now,
  };

  const transaction: StoredTransaction = {
    id: `tx-${crypto.randomUUID()}`,
    amount: params.reward,
    type: "EARN",
    description: `Выполнение задания «${params.taskTitle}»`,
    createdAt: now,
  };

  const next: UserState = {
    ...state,
    balance: state.balance + params.reward,
    totalEarned: state.totalEarned + params.reward,
    completedTasks: state.completedTasks + 1,
    submissions: [submission, ...state.submissions].slice(0, MAX_SUBMISSIONS),
    transactions: [transaction, ...state.transactions].slice(0, MAX_TRANSACTIONS),
  };

  return { state: next, submission, transaction };
}


