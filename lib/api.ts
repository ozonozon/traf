/** Единый формат ошибок API: { code, message, issues?, details? }. */
export interface ApiErrorPayload {
  code: string;
  message: string;
  issues?: Array<{ path: string; message: string }>;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: Array<{ path: string; message: string }>;
  /** Дополнительные данные ошибки (например, статусы Telegram-каналов). */
  readonly details?: unknown;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.issues = payload.issues;
    this.details = payload.details;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as Partial<ApiErrorPayload>;
    return new ApiError(
      {
        code: data.code ?? "REQUEST_FAILED",
        message: data.message ?? "Не удалось выполнить запрос",
        issues: data.issues,
        details: data.details,
      },
      response.status,
    );
  } catch {
    return new ApiError({ code: "REQUEST_FAILED", message: "Не удалось выполнить запрос" }, response.status);
  }
}

/** fetch с JSON-ответом и унифицированными ошибками.
 *
 * Единая точка для всех запросов к API приложения:
 *  - same-origin относительные URL (никаких внешних origin — CORS не нужен);
 *  - `credentials: "include"` — session cookie обязана уходить с каждым запросом;
 *  - `cache: "no-store"` — ответы API не кэшируются.
 */
export async function apiFetch<T>(url: string, options?: { json?: unknown; method?: string }): Promise<T> {
  const init: RequestInit = {
    method: options?.method ?? (options?.json ? "POST" : "GET"),
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  };

  if (options?.json !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(options.json);
  }

  const response = await fetch(url, init);
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
