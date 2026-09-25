"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { getWebApp, onThemeChanged } from "@/lib/telegram";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: "Системная",
  light: "Светлая",
  dark: "Тёмная",
};

const THEME_BACKGROUNDS: Record<ResolvedTheme, string> = {
  light: "#FFFFFF",
  dark: "#111111",
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function readModeFromStorage(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

/** Системная тема: Telegram colorScheme, иначе prefers-color-scheme. */
function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const webApp = getWebApp();
  if (webApp && (webApp.colorScheme === "dark" || webApp.colorScheme === "light")) {
    return webApp.colorScheme;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === "system" ? systemTheme : mode;
}

// --- Внешний store (localStorage + системная тема) ---

type Listener = () => void;

const modeListeners = new Set<Listener>();
const systemListeners = new Set<Listener>();

let cachedMode: ThemeMode | null = null;
let cachedSystemTheme: ResolvedTheme | null = null;
let systemUnbind: (() => void) | null = null;

function notify(listeners: Set<Listener>) {
  listeners.forEach((listener) => listener());
}

function getThemeModeSnapshot(): ThemeMode {
  if (cachedMode === null) cachedMode = readModeFromStorage();
  return cachedMode;
}

function getSystemThemeSnapshot(): ResolvedTheme {
  if (cachedSystemTheme === null) cachedSystemTheme = readSystemTheme();
  return cachedSystemTheme;
}

function refreshSystemTheme(): void {
  const next = readSystemTheme();
  if (next === cachedSystemTheme) return;
  cachedSystemTheme = next;
  notify(systemListeners);
}

/** Установка режима темы: сохраняет выбор в localStorage (voxy-theme). */
export function setThemeMode(mode: ThemeMode): void {
  cachedMode = mode;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Приватный режим/запрет localStorage: настройка живёт до перезагрузки.
  }
  applyThemeToDocument(resolveTheme(mode, getSystemThemeSnapshot()), true);
  notify(modeListeners);
}

/** Применение темы к документу (.dark + data-атрибуты + цвета Telegram). */
export function applyThemeToDocument(theme: ResolvedTheme, animate = false): void {
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 220);
  }

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.dataset.themeMode = getThemeModeSnapshot();
  root.style.colorScheme = theme;

  const background = THEME_BACKGROUNDS[theme];
  try {
    getWebApp()?.setBackgroundColor?.(background);
    getWebApp()?.setHeaderColor?.(background);
  } catch {
    // Старые версии Telegram WebApp могут не поддерживать эти методы.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
}

function subscribeThemeMode(listener: Listener): () => void {
  modeListeners.add(listener);

  // Синхронизация между вкладками / окнами
  const onStorage = () => {
    cachedMode = readModeFromStorage();
    notify(modeListeners);
  };
  window.addEventListener("storage", onStorage);

  return () => {
    modeListeners.delete(listener);
    if (modeListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function subscribeSystemTheme(listener: Listener): () => void {
  systemListeners.add(listener);

  if (!systemUnbind) {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const mediaHandler = () => refreshSystemTheme();
    media?.addEventListener("change", mediaHandler);

    // Telegram: themeChanged + возврат в приложение (activated)
    const unsubscribeTelegram = onThemeChanged(refreshSystemTheme);
    const webApp = getWebApp();
    const activatedHandler = () => refreshSystemTheme();
    webApp?.onEvent?.("activated", activatedHandler);

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") refreshSystemTheme();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    systemUnbind = () => {
      media?.removeEventListener("change", mediaHandler);
      unsubscribeTelegram();
      webApp?.offEvent?.("activated", activatedHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      systemUnbind = null;
    };
  }

  return () => {
    systemListeners.delete(listener);
    if (systemListeners.size === 0) systemUnbind?.();
  };
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useSyncExternalStore(subscribeThemeMode, getThemeModeSnapshot, () => DEFAULT_THEME_MODE);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemThemeSnapshot, () => "light" as const);
  const resolvedTheme = resolveTheme(themeMode, systemTheme);
  const appliedTheme = useRef<ResolvedTheme | null>(null);

  useEffect(() => {
    // Анимируем только реальную смену темы; первое применение мгновенное (нет мигания).
    const isSwitch = appliedTheme.current !== null && appliedTheme.current !== resolvedTheme;
    applyThemeToDocument(resolvedTheme, isSwitch);
    appliedTheme.current = resolvedTheme;
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    const current = resolveTheme(getThemeModeSnapshot(), getSystemThemeSnapshot());
    setThemeMode(current === "dark" ? "light" : "dark");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeMode, resolvedTheme, systemTheme, setThemeMode, toggleTheme }),
    [themeMode, resolvedTheme, systemTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme должен использоваться внутри ThemeProvider");
  }
  return context;
}
