/**
 * Обёртка над Telegram WebApp API.
 * Все методы безопасны вне Telegram: возвращают null/no-op, приложение не падает.
 * Требует, чтобы в <head> был подключён telegram-web-app.js (см. app/layout.tsx).
 */

import type { PublicUserDto } from "./types";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebAppApi {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string | undefined>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppApi };
  }
}

/** Экземпляр Telegram WebApp или null (браузер / SSR). */
export function getWebApp(): TelegramWebAppApi | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramAvailable(): boolean {
  return getWebApp() !== null;
}

/** ready() + expand(): вызывается один раз при старте приложения. */
export function initTelegram(): TelegramWebAppApi | null {
  const webApp = getWebApp();
  if (!webApp) return null;
  try {
    webApp.ready();
    webApp.expand();
    // NB: disableVerticalSwipes() намеренно НЕ вызываем — в части клиентов Telegram
    // он перехватывает вертикальные свайпы и мешает прокрутке контента.
  } catch {
    // Некоторые версии WebApp могут не поддерживать отдельные методы.
  }
  return webApp;
}

/**
 * Ключ хранения initData. Хранится в sessionStorage и, как fallback, в localStorage:
 * Telegram-клиент может перезагрузить WebView без `#tgWebAppData` (например, после
 * возврата из канала, открытого кнопкой «ПОДПИСАТЬСЯ»), и тогда initData из SDK пуст.
 * В cookie и URL initData НИКОГДА не попадает.
 */
const INIT_DATA_STORAGE_KEY = "voxy-init-data";

/** Максимальный возраст сохранённого initData: сервер принимает до 24 ч, берём запас. */
const INIT_DATA_MAX_AGE_SECONDS = 23 * 60 * 60;

/** initData ещё годен (auth_date есть и не старше 23 часов). */
function isInitDataFresh(initData: string): boolean {
  try {
    const authDate = Number(new URLSearchParams(initData).get("auth_date") ?? 0);
    if (!authDate) return false;
    return Math.floor(Date.now() / 1000) - authDate < INIT_DATA_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}

/** Сохранённый initData: сначала sessionStorage вкладки, затем localStorage. */
function readStoredInitData(): string {
  if (typeof window === "undefined") return "";

  let stored = "";
  try {
    stored = window.sessionStorage.getItem(INIT_DATA_STORAGE_KEY) ?? "";
  } catch {
    stored = "";
  }
  if (!stored) {
    try {
      stored = window.localStorage.getItem(INIT_DATA_STORAGE_KEY) ?? "";
    } catch {
      stored = "";
    }
  }

  if (!stored) return "";
  if (isInitDataFresh(stored)) return stored;

  // Просроченный initData бесполезен (сервер его отклонит) — забываем его.
  clearStoredInitData();
  return "";
}

/** Запоминает initData на время сессии (и переживает перезагрузку WebView). */
function storeInitData(initData: string): void {
  try {
    window.sessionStorage.setItem(INIT_DATA_STORAGE_KEY, initData);
  } catch {
    // Приватный режим/запрет storage — не критично, останется localStorage.
  }
  try {
    window.localStorage.setItem(INIT_DATA_STORAGE_KEY, initData);
  } catch {
    // Хранилище недоступно — работаем без него.
  }
}

function clearStoredInitData(): void {
  try {
    window.sessionStorage.removeItem(INIT_DATA_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(INIT_DATA_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Единый источник Telegram initData для всех запросов к API.
 *
 * Приоритет:
 *   1. window.Telegram.WebApp.initData — свежие данные от клиента;
 *   2. сохранённый initData в sessionStorage этой вкладки;
 *   3. сохранённый initData в localStorage.
 *
 * Свежее значение всегда перезаписывает сохранённое. Значение передаётся только в
 * заголовке X-Telegram-Init-Data и проверяется на сервере той же HMAC-подписью, что и
 * при входе; сам клиент никакой авторизации не выполняет.
 */
export function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";

  const live = getWebApp()?.initData ?? "";
  if (live) {
    storeInitData(live);
    return live;
  }

  return readStoredInitData();
}

/**
 * Заголовок, которым клиент дублирует initData для защищённых запросов.
 * Сервер принимает его только если сессионная cookie не пришла (Mini App в iframe),
 * и проверяет той же подписью, что и при входе.
 */
export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

/**
 * Ждёт, пока Telegram-клиент отдаст initData.
 *
 * На холодном старте Mini App объект window.Telegram и строка initData появляются
 * не строго к моменту гидратации: клиент подставляет их чуть позже, а SDK грузится
 * отдельным скриптом. Без ожидания авторизация уходит на сервер с пустым initData,
 * падает, и всё приложение остаётся неавторизованным до перезагрузки.
 *
 * Внутри Telegram (в URL есть tgWebAppData) ждём до timeoutMs; в обычном браузере,
 * где SDK уже загрузился, но initData так и не появился, выходим раньше — ждать нечего.
 */
export async function waitForInitData(timeoutMs = 8000, stepMs = 150): Promise<string> {
  if (typeof window === "undefined") return "";

  // Если в этой вкладке уже был валидный initData (например, страница перезагружена
  // Telegram-клиентом без #tgWebAppData), не ждём SDK повторно.
  if (!getWebApp()?.initData) {
    const stored = readStoredInitData();
    if (stored) {
      initTelegram();
      return stored;
    }
  }

  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const looksLikeMiniApp = /tgWebAppData/.test(window.location.hash) || /tgWebAppData/.test(window.location.search);

  for (;;) {
    const webApp = getWebApp();
    if (webApp) {
      // ready()/expand() вызываем сразу, как только SDK появился.
      initTelegram();
      if (webApp.initData) {
        storeInitData(webApp.initData);
        return webApp.initData;
      }
    }

    // Вне Telegram (в URL нет tgWebAppData) ждать нечего: не держим интерфейс в загрузке.
    if (!looksLikeMiniApp && Date.now() - startedAt > 1500) return getTelegramInitData();
    if (Date.now() >= deadline) return getTelegramInitData();
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

/**
 * Открывает Telegram-ссылку (в т.ч. invite-ссылку канала) нативным методом Telegram.
 * Вызывается кнопкой «ПОДПИСАТЬСЯ»; сама по себе подписку не засчитывает.
 */
export function openTelegramChannelLink(url: string): void {
  const webApp = getWebApp();

  if (webApp?.openTelegramLink) {
    try {
      webApp.openTelegramLink(url);
      return;
    } catch {
      // Метод недоступен на старых версиях — открываем обычным способом.
    }
  }

  openExternalLink(url);
}

/** Пользователь из initDataUnsafe (только для UI, доверять можно лишь серверу). */
export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

/**
 * Локальный пользователь для отображения, когда серверная сессия недоступна.
 *
 * Имя, @username и аватар берутся из Telegram (initDataUnsafe — непроверенные данные,
 * они используются только для показа). Денежные значения — нули: настоящие суммы живут
 * в подписанном состоянии на сервере, и как только сессия появится, профиль перезапишется
 * серверными данными. Это предохранитель, чтобы экран профиля не оставался пустым.
 */
export function toLocalUser(telegramUser: TelegramUser): PublicUserDto {
  return {
    username: telegramUser.username ?? null,
    firstName: telegramUser.first_name || "Пользователь",
    lastName: telegramUser.last_name ?? null,
    photoUrl: telegramUser.photo_url ?? null,
    balance: 0,
    totalEarned: 0,
    completedTasks: 0,
    isDemo: false,
  };
}

export function getThemeParams(): Record<string, string | undefined> {
  return getWebApp()?.themeParams ?? {};
}

export function getColorScheme(): "light" | "dark" {
  return getWebApp()?.colorScheme ?? "light";
}

/** Подписка на изменение темы Telegram. Возвращает функцию отписки. */
export function onThemeChanged(handler: () => void): () => void {
  const webApp = getWebApp();
  if (!webApp) return () => undefined;
  webApp.onEvent("themeChanged", handler);
  return () => webApp.offEvent("themeChanged", handler);
}

export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light"): void {
  getWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function hapticSelection(): void {
  getWebApp()?.HapticFeedback?.selectionChanged();
}

export function hapticNotification(type: "error" | "success" | "warning" = "success"): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}

/** Показать нативную кнопку «Назад». Возвращает функцию очистки. */
export function showBackButton(onClick: () => void): () => void {
  const webApp = getWebApp();
  if (!webApp) return () => undefined;
  webApp.BackButton.onClick(onClick);
  webApp.BackButton.show();
  return () => {
    webApp.BackButton.offClick(onClick);
    webApp.BackButton.hide();
  };
}

export function hideBackButton(): void {
  getWebApp()?.BackButton.hide();
}

export function closeApp(): void {
  getWebApp()?.close();
}

/**
 * Открытие внешней ссылки: внутри Telegram используем нативные методы WebApp,
 * иначе — обычное новое окно.
 */
export function openExternalLink(url: string): void {
  const webApp = getWebApp();

  if (webApp && (webApp.openTelegramLink || webApp.openLink)) {
    try {
      if (url.startsWith("https://t.me/") || url.startsWith("tg://")) {
        webApp.openTelegramLink?.(url);
      } else {
        webApp.openLink?.(url);
      }
      return;
    } catch {
      // Метод недоступен на старых версиях — открываем обычным способом.
    }
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
