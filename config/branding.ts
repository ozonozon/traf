/**
 * Единая точка брендинга приложения.
 * Название, описание, логотип и основной цвет меняются только здесь.
 */
export const branding = {
  name: "PayDoEarn",
  description: "платформа заданий",
  /** Иконка приложения лежит в public/ и отдаётся по этому пути. */
  logoUrl: "/paydoearn-icon.png",
  primaryColor: "#6C5CE7",
} as const;

export const copy = {
  currency: "₽",
  currencyName: "виртуальные рубли",
} as const;

