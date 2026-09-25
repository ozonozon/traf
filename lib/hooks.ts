"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, isApiError, type ApiError } from "./api";

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

function toApiError(cause: unknown): ApiError {
  if (isApiError(cause)) return cause;
  return Object.assign(new Error("Request failed"), { code: "REQUEST_FAILED", status: 0 }) as ApiError;
}

/**
 * Простейший data-fetching хук для клиентских экранов (без внешних зависимостей).
 * isLoading выводится из состояния, чтобы не вызывать setState синхронно в эффекте.
 */
export function useApi<T>(url: string | null): UseApiResult<T> {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<ApiResult<T> | null>(null);

  const requestKey = url === null ? null : `${url}#${nonce}`;

  useEffect(() => {
    if (url === null || requestKey === null) return undefined;

    let cancelled = false;

    apiFetch<T>(url)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: toApiError(cause) });
      });

    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);
  const isFresh = result !== null && result.key === requestKey;

  return {
    data: isFresh ? result.data : null,
    error: isFresh ? result.error : null,
    isLoading: url !== null && !isFresh,
    refresh,
  };
}
