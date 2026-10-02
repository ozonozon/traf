/**
 * Единая точка брендинга приложения.
 * Название, описание, логотип и основной цвет меняются только здесь.
 */
export const branding = {
  name: "PayDoEarn",
  description: "платформа заданий",
  /** Иконка приложения лежит в public/ и отдаётся по этому пути. */
  logoUrl: "/paydoearn-icon.png",
  /** Баннер приветственного сообщения /start (файл лежит в public/telegram-start-banner.png). */
  startBanner: "/telegram-start-banner.png",
  primaryColor: "#6C5CE7",
} as const;

export const copy = {
  currency: "₽",
  currencyName: "виртуальные рубли",
} as const;

