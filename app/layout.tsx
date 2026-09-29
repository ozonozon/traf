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
