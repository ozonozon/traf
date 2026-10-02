"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiFetch, isApiError, type ApiError } from "@/lib/api";
import {
  getTelegramUser,
  hideBackButton,
  initTelegram,
  showBackButton,
  toLocalUser,
  waitForInitData,
} from "@/lib/telegram";
import type { AuthResponseDto, ProfileResponseDto, PublicUserDto } from "@/lib/types";

export type SessionStatus = "loading" | "ready" | "error";

interface SessionValue {
  /** loading — идёт авторизация; ready — сессия установлена; error — вход не удался. */
  status: SessionStatus;
  /** true только после успешной авторизации: до этого защищённые запросы не выполняются. */
  isReady: boolean;
  /** Совместимость со страницами: true, пока авторизация не завершена. */
  isLoading: boolean;
  user: PublicUserDto | null;
  error: ApiError | null;
  isDemo: boolean;
  /** Растёт при каждом успешном входе — по нему экраны перезапрашивают данные. */
  version: number;
  /** Повторить вход (например, если initData пришёл позже). */
  retry: () => void;
  reauthenticate: () => Promise<PublicUserDto | null>;
  /** fetch к API с session cookie и одним автоматическим повтором при 401. */
  authedFetch: <T>(url: string, options?: { json?: unknown; method?: string }) => Promise<T>;
  setUser: (user: PublicUserDto) => void;
  refreshUser: () => Promise<void>;
}

interface SessionState {
  /** Номер попытки входа, к которой относится это состояние (свежесть состояния). */
  attempt: number;
  /** Растёт при каждом успешном входе: по нему экраны перезапрашивают данные. */
  version: number;
  status: SessionStatus;
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
 * сессия появится (данные пользователя живут в PostgreSQL, доступ — по session cookie).
 */
function localUserFromTelegram(): PublicUserDto | null {
  const telegramUser = getTelegramUser();
  return telegramUser ? toLocalUser(telegramUser) : null;
}

/**
 * Авторизация Telegram Mini App.
 *
 * Гарантированный порядок:
 *  1) ждём initData от Telegram-клиента (он появляется не мгновенно);
 *  2) отправляем его в /api/auth/telegram;
 *  3) сервер проверяет подпись и находит/создаёт пользователя в PostgreSQL;
 *  4) сервер ставит подписанную session cookie;
 *  5) только после успеха status становится "ready", и экраны (через useAuthedApi)
 *     начинают вызывать /api/channel-subscriptions, /api/profile, /api/leaderboard,
 *     /api/profile, /api/transactions. Раньше этого момента защищённые запросы не идут.
 */
export function TelegramProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SessionState | null>(null);
  const reauthRef = useRef<Promise<PublicUserDto | null> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  /** Один вход: initData → /api/auth/telegram → сессия. Возвращает пользователя. */
  const signIn = useCallback(async (): Promise<PublicUserDto> => {
    const initData = await waitForInitData();
    const data = await apiFetch<AuthResponseDto>("/api/auth/telegram", { json: { initData } });
    return data.user;
  }, []);

  /** Фиксирует успешный вход: состояние становится ready, версия сессии растёт. */
  const applyUser = useCallback((user: PublicUserDto) => {
    setState((current) => ({
      attempt: current?.attempt ?? 0,
      version: (current?.version ?? 0) + 1,
      status: "ready",
      user,
      error: null,
    }));
  }, []);

  const reauthenticate = useCallback(async (): Promise<PublicUserDto | null> => {
    // Одновременные 401 от нескольких экранов делят один повторный вход.
    if (!reauthRef.current) {
      reauthRef.current = (async () => {
        try {
          const user = await signIn();
          applyUser(user);
          return user;
        } catch {
          return null;
        } finally {
          reauthRef.current = null;
        }
      })();
    }

    return reauthRef.current;
  }, [signIn, applyUser]);

  // Основной эффект авторизации: монтирование и повтор по retry().
  useEffect(() => {
    let cancelled = false;

    initTelegram();

    (async () => {
      try {
        const user = await signIn();
        if (cancelled) return;
        setState((current) => ({
          attempt,
          version: (current?.version ?? 0) + 1,
          status: "ready",
          user,
          error: null,
        }));
      } catch (cause) {
        if (cancelled) return;
        setState((current) => ({
          attempt,
          version: current?.version ?? 0,
          status: "error",
          user: localUserFromTelegram(),
          error: toApiError(cause),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, signIn]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  // Тема управляется ThemeProvider (components/theme/theme-provider.tsx).

  /**
   * Если Mini App вернулся из фона (например, пользователь отправлял заявку в канале),
   * а сессии всё ещё нет — пробуем войти снова: initData к этому моменту уже есть.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (state?.status === "error") retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state, retry]);

  /** Единый авторизованный fetch: 401 → один повторный вход → повтор запроса. */
  const authedFetch = useCallback(
    async <T,>(url: string, options?: { json?: unknown; method?: string }): Promise<T> => {
      try {
        return await apiFetch<T>(url, options);
      } catch (cause) {
        if (!isApiError(cause) || cause.status !== 401) throw cause;

        const user = await reauthenticate();
        if (!user) throw cause;
        return apiFetch<T>(url, options);
      }
    },
    [reauthenticate],
  );

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
      const data = await authedFetch<ProfileResponseDto>("/api/profile");
      setState((current) => (current ? { ...current, user: data.user, error: null } : current));
    } catch {
      // Тихо игнорируем: баланс обновится при следующем запросе.
    }
  }, [authedFetch]);

  const setUser = useCallback((nextUser: PublicUserDto) => {
    setState((current) => (current ? { ...current, user: nextUser } : current));
  }, []);

  const isFresh = state !== null && state.attempt === attempt;
  const status: SessionStatus = isFresh && state ? state.status : "loading";
  const user = isFresh && state ? state.user : null;
  const error = isFresh && state ? state.error : null;

  const value = useMemo<SessionValue>(
    () => ({
      status,
      isReady: status === "ready",
      isLoading: status === "loading",
      user,
      error,
      isDemo: user?.isDemo ?? false,
      version: state?.version ?? 0,
      retry,
      reauthenticate,
      authedFetch,
      setUser,
      refreshUser,
    }),
    [status, user, error, state, retry, reauthenticate, authedFetch, setUser, refreshUser],
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
