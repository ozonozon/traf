"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, isApiError, type ApiError } from "./api";
import { useSession } from "@/components/telegram/TelegramProvider";

export interface UseApiResult<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  refresh: () => void;
}

interface ApiResult<T> {
  key: string;
  data: T | null;
  error: ApiError | null;
}

interface UseApiOptions {
  /** Дополнительный ключ: при его изменении запрос выполняется заново (например, версия сессии). */
  version?: number | string;
  /** Механизм запроса; по умолчанию apiFetch. */
  fetcher?: <T>(url: string, options?: { json?: unknown; method?: string }) => Promise<T>;
}

function toApiError(cause: unknown): ApiError {
  if (isApiError(cause)) return cause;
  return Object.assign(new Error("Request failed"), { code: "REQUEST_FAILED", status: 0 }) as ApiError;
}

/** Ошибка для случая «сессия не установлена»: экран покажет её и кнопку повтора. */
function unauthorizedError(): ApiError {
  return Object.assign(new Error("Нужно открыть приложение внутри Telegram"), {
    code: "UNAUTHORIZED",
    status: 401,
  }) as ApiError;
}

/**
 * Простейший data-fetching хук для клиентских экранов (без внешних зависимостей).
 * isLoading выводится из состояния, чтобы не вызывать setState синхронно в эффекте.
 */
export function useApi<T>(url: string | null, options?: UseApiOptions): UseApiResult<T> {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<ApiResult<T> | null>(null);

  const version = options?.version ?? 0;
  const fetcher = options?.fetcher ?? apiFetch;
  const requestKey = url === null ? null : `${url}#${nonce}#${version}`;

  useEffect(() => {
    if (url === null || requestKey === null) return undefined;

    let cancelled = false;

    fetcher<T>(url)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: toApiError(cause) });
      });

    return () => {
      cancelled = true;
    };
  }, [url, requestKey, fetcher]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);
  const isFresh = result !== null && result.key === requestKey;

  return {
    data: isFresh ? result.data : null,
    error: isFresh ? result.error : null,
    isLoading: url !== null && !isFresh,
    refresh,
  };
}

/**
 * Хук для запросов, которым нужна сессия Telegram Mini App.
 *
 * Гарантирует порядок: пока авторизация не завершилась (session.isReady === false),
 * запрос вообще не отправляется — тем самым `/api/channel-requests`, `/api/stats`,
 * `/api/leaderboard`, `/api/profile`, `/api/transactions` не могут уйти раньше,
 * чем сервер поставил session cookie. При смене версии сессии данные перезапрашиваются,
 * а 401 один раз автоматически лечится повторным входом (session.authedFetch).
 *
 * Если же вход не удался (нет initData, нет TELEGRAM_BOT_TOKEN, база недоступна),
 * экран получает ошибку с кнопкой повтора, которая запускает повторную авторизацию.
 */
export function useAuthedApi<T>(path: string | null): UseApiResult<T> {
  const session = useSession();

  const result = useApi<T>(session.isReady ? path : null, {
    version: session.version,
    fetcher: session.authedFetch,
  });

  const refresh = useCallback(() => {
    // Повтор сначала повторяет вход (cookie могла отсутствовать/истечь), затем запрос.
    if (!session.isReady) session.retry();
    result.refresh();
  }, [session, result]);

  if (!session.isReady) {
    const failed = session.status === "error";
    return {
      data: null,
      error: failed ? (session.error ?? unauthorizedError()) : null,
      isLoading: !failed,
      refresh,
    };
  }

  return { ...result, refresh };
}

