import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "./auth";
import { getAdminToken } from "./env";
import type { UserModel } from "./generated/prisma/models";

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

  // Гонка при повторной отправке задания: сработал unique(userId, taskId).
  if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
    return jsonError("TASK_ALREADY_COMPLETED", "Вы уже выполняли это задание", 409);
  }

  console.error("[api] unexpected error:", error);
  return jsonError("REQUEST_FAILED", "Не удалось выполнить запрос", 500);
}

/** Пользователь из сессии или 401. userId с фронтенда никогда не принимается. */
export async function requireUser(): Promise<UserModel> {
  const user = await getCurrentUser();
  if (!user) {
    throw new RouteError("UNAUTHORIZED", "Нужно открыть приложение внутри Telegram", 401);
  }
  return user;
}

/** Доступ к admin API по токену из .env. Без ADMIN_TOKEN роуты выключены (503). */
export function requireAdmin(request: Request): void {
  const expected = getAdminToken();
  if (!expected) {
    throw new RouteError("ADMIN_DISABLED", "Админ-доступ не настроен", 503);
  }
  const provided = request.headers.get("x-admin-token");
  if (!provided || provided !== expected) {
    throw new RouteError("FORBIDDEN", "Недостаточно прав", 403);
  }
}
