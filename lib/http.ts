import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentUser, getUserFromInitData } from "./auth";
import type { UserRow } from "./db";
import { TELEGRAM_INIT_DATA_HEADER } from "./telegram";

export interface IssuePayload {
  path: string;
  message: string;
}

/** Ошибка уровня route handler: превращается в аккуратный JSON без stack trace. */
export class RouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: IssuePayload[];
  /** Дополнительные данные (например, статусы каналов Telegram). */
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    issues?: IssuePayload[],
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RouteError";
    this.code = code;
    this.status = status;
    this.issues = issues;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  issues?: IssuePayload[],
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { code, message, ...(issues ? { issues } : {}), ...(details ? { details } : {}) },
    { status },
  );
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof RouteError) {
    return jsonError(error.code, error.message, error.status, error.issues, error.details);
  }

  console.error("[api] unexpected error:", error);
  return jsonError("REQUEST_FAILED", "Не удалось выполнить запрос", 500);
}

/**
 * Пользователь из подписанной сессии или 401.
 * Telegram id и userId с фронтенда никогда не принимаются как доверенные.
 *
 * Если сессионной cookie нет, принимается initData в заголовке `X-Telegram-Init-Data`
 * (тот же формат и та же проверка подписи, что при входе). Это нужно для случаев, когда
 * Telegram-клиент не сохраняет cookie (Mini App в iframe) — иначе кнопки защищённых
 * действий отвечали бы 401 при полностью рабочем входе.
 */
export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (user) return user;

  const initDataHeader = (await headers()).get(TELEGRAM_INIT_DATA_HEADER);
  const userFromInitData = await getUserFromInitData(initDataHeader);
  if (userFromInitData) return userFromInitData;

  throw new RouteError("UNAUTHORIZED", "Нужно открыть приложение внутри Telegram", 401);
}

