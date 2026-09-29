import type { Metadata, Viewport } from "next";

import "./globals.css";

import { BottomNav } from "@/components/layout/BottomNav";
import { TelegramProvider } from "@/components/telegram/TelegramProvider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/Toast";
import { branding } from "@/config/branding";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: `${branding.name} — ${branding.description}`,
  description:
    "Тренировочный симулятор платформы заданий: выполняйте виртуальные задания и получайте виртуальные рубли внутри приложения.",
  applicationName: branding.name,
  icons: {
    icon: [{ url: branding.logoUrl, type: "image/png" }],
    apple: [{ url: branding.logoUrl, type: "image/png" }],
  },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: branding.primaryColor,
};

/** Тема применяется скриптом из lib/theme-script.ts до первой отрисовки. */

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/*
          Официальный Telegram WebApp SDK. Без него window.Telegram не существует,
          initData пустой, авторизация на сервере не проходит и профиль остаётся
          без данных. Скрипт должен выполниться до гидратации приложения, поэтому
          он подключается в <head> синхронно (как рекомендует документация Telegram).
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
        {/*
          Тема применяется до первой отрисовки: сохранённый режим -> Telegram colorScheme
          -> prefers-color-scheme -> light. Это исключает мигание светлого экрана.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <TelegramProvider>
              <div id="app" className="app-frame">
                {children}
              </div>
              <BottomNav />
            </TelegramProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
