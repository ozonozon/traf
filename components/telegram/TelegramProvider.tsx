"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch, isApiError, type ApiError } from "@/lib/api";
import { getInitData, getTelegramUser, hideBackButton, initTelegram, showBackButton, toLocalUser } from "@/lib/telegram";
import type { AuthResponseDto, ProfileResponseDto, PublicUserDto } from "@/lib/types";

interface SessionValue {
  user: PublicUserDto | null;
  isLoading: boolean;
  error: ApiError | null;
  isDemo: boolean;
  retry: () => void;
  setUser: (user: PublicUserDto) => void;
  refreshUser: () => Promise<void>;
}

interface SessionState {
  key: number;
  user: PublicUserDto | null;
  error: ApiError | null;
}

const SessionContext = createContext<SessionValue | null>(null);

function toApiError(cause: unknown): ApiError {
  if (isApiError(cause)) return cause;
  return Object.assign(new Error("Auth failed"), { code: "REQUEST_FAILED", status: 0 }) as ApiError;
}

/**
 * Пользователь для отображения, когда серверный вход не удался: имя, @username и аватар
 * из Telegram. Так профиль и шапка не остаются пустыми, а суммы подтянутся, как только
 * сессия появится (регистрация состояния идёт через подписанную cookie на сервере).
 */
function localUserFromTelegram(): PublicUserDto | null {
  const telegramUser = getTelegramUser();
  return telegramUser ? toLocalUser(telegramUser) : null;
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<SessionState | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Авторизация: initData уходит на сервер, сервер валидирует подпись и ставит сессию.
  useEffect(() => {
    let cancelled = false;

    initTelegram();

    (async () => {
      try {
        const data = await apiFetch<AuthResponseDto>("/api/auth/telegram", { json: { initData: getInitData() } });
        if (cancelled) return;
        setState({ key: nonce, user: data.user, error: null });
      } catch (cause) {
        if (cancelled) return;
        setState({ key: nonce, user: localUserFromTelegram(), error: toApiError(cause) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Тема управляется ThemeProvider (components/theme/theme-provider.tsx).

  // Нативная кнопка «Назад» только на внутренних экранах.
  useEffect(() => {
    const isTaskDetail = /^\/tasks\/[^/]+$/.test(pathname);
    if (!isTaskDetail) {
      hideBackButton();
      return undefined;
    }
    return showBackButton(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/tasks");
      }
    });
  }, [pathname, router]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<ProfileResponseDto>("/api/profile");
      setState((current) => ({ key: current?.key ?? 0, user: data.user, error: null }));
    } catch {
      // Тихо игнорируем: баланс обновится при следующем запросе.
    }
  }, []);

  const setUser = useCallback((nextUser: PublicUserDto) => {
    setState((current) => ({ key: current?.key ?? 0, user: nextUser, error: null }));
  }, []);

  const retry = useCallback(() => setNonce((current) => current + 1), []);

  const isFresh = state !== null && state.key === nonce;
  const user = isFresh ? state.user : null;
  const error = isFresh ? state.error : null;
  const isLoading = !isFresh;

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isLoading,
      error,
      isDemo: user?.isDemo ?? false,
      retry,
      setUser,
      refreshUser,
    }),
    [user, isLoading, error, retry, setUser, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession должен использоваться внутри TelegramProvider");
  }
  return context;
}
