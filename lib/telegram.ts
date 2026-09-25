/**
 * Обёртка над Telegram WebApp API.
 * Все методы безопасны вне Telegram: возвращают null/no-op, приложение не падает.
 */

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

/** Строка initData для серверной валидации. */
export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

/** Пользователь из initDataUnsafe (только для UI, доверять можно лишь серверу). */
export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
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
