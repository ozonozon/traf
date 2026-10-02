const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** Объединение className без внешних зависимостей. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 28940 -> "28 940" */
export function formatAmount(value: number): string {
  return NUMBER_FORMATTER.format(Math.round(value));
}

/** 330 -> "+330 ₽", -330 -> "-330 ₽" */
export function formatSignedRub(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatAmount(Math.abs(value))} ₽`;
}

/** 330 -> "330 ₽" */
export function formatRub(value: number): string {
  return `${formatAmount(value)} ₽`;
}

/**
 * Сумма бонусов в русском формате с точками-разделителями тысяч:
 * 2235890 -> "+2.235.890 руб"
 */
export function formatBonusAmount(value: number): string {
  const sign = value < 0 ? "−" : "+";
  const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits} руб`;
}

/** 360 -> "₽ 360" (формат баланса в хедере) */
export function formatBalance(value: number): string {
  return `₽ ${formatAmount(value)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO -> "10.09.2026" */
export function formatDate(input: Date | string): string {
  const date = new Date(input);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** ISO -> "23:59" */
export function formatTime(input: Date | string): string {
  const date = new Date(input);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/** Дедлайн задания: "до 23:59" если сегодня, иначе "до 12.09 23:59". */
export function formatDeadline(input: Date | string): string {
  const date = new Date(input);
  if (isSameDay(date, new Date())) return `до ${formatTime(date)}`;
  return `до ${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${formatTime(date)}`;
}

/** Русские склонения: plural(3, "задание", "задания", "заданий") */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Инициалы для аватара без photoUrl. */
export function initials(firstName: string, lastName?: string | null, username?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (username) return username.replace(/^@/, "").slice(0, 2).toUpperCase();
  return "VO";
}

/** Детерминированный цвет аватара (без внешних сервисов). */
export function avatarGradient(seed: string): string {
  const palette = [
    ["#0062FD", "#3D8BFF"],
    ["#20B26B", "#4BD08B"],
    ["#F59E0B", "#FBBF24"],
    ["#EF4444", "#F87171"],
    ["#0EA5E9", "#38BDF8"],
    ["#8B5CF6", "#C4B5FD"],
    ["#EC4899", "#F9A8D4"],
    ["#14B8A6", "#5EEAD4"],
  ];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  const [from, to] = palette[hash % palette.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

/** Коды ошибок API -> человекочитаемые сообщения. */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Нужно открыть приложение внутри Telegram",
  INVALID_INIT_DATA: "Не удалось проверить данные Telegram",
  TELEGRAM_UNAVAILABLE: "Telegram недоступен, обновите приложение",
  TASK_NOT_FOUND: "Задание не найдено",
  TASK_NOT_ACTIVE: "Задание больше не доступно",
  TASK_EXPIRED: "Срок выполнения задания истёк",
  TASK_ALREADY_COMPLETED: "Вы уже выполняли это задание",
  SUBSCRIPTIONS_INCOMPLETE: "Подписка подтверждена не по всем каналам",
  TELEGRAM_CHANNEL_CHECK_FAILED: "Не удалось проверить подписку. Попробуйте позже",
  JOIN_REQUESTS_INCOMPLETE: "Ожидаем подтверждение заявок от Telegram",
  TASKS_LOCKED: "Сначала выполните обязательное задание «Подписка на Telegram-каналы»",
  INVALID_TICKET: "Ссылка подтверждения недействительна",
  TICKET_FOR_OTHER_USER: "Эта заявка относится к другому пользователю",
  TEXT_TOO_SHORT: "Ответ слишком короткий",
  RATING_REQUIRED: "Выберите оценку",
  INVALID_OPTION: "Некорректный вариант ответа",
  VALIDATION_ERROR: "Проверьте заполненные поля",
  NOT_FOUND: "Данные не найдены",
  REQUEST_FAILED: "Не удалось выполнить запрос",
  ADMIN_DISABLED: "Админ-доступ не настроен",
  FORBIDDEN: "Недостаточно прав",
};

export function getErrorMessage(code: string | null | undefined): string {
  if (!code) return ERROR_MESSAGES.REQUEST_FAILED;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.REQUEST_FAILED;
}
