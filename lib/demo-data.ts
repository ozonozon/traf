/**
 * Задания — демонстрационные, живут в коде (реальные данные пользователя в PostgreSQL).
 *
 * Дедлайн «до 23:59» вычисляется от текущего дня, чтобы задания всегда были доступны.
 */

import { TELEGRAM_SUBSCRIPTION_TASK_ID, TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";

export interface DemoTaskOption {
  id: string;
  text: string;
}

export interface DemoTask {
  id: string;
  title: string;
  description: string;
  conditions: string;
  virtualTarget: string;
  type: string;
  icon: string;
  reward: number;
  minLength: number;
  requiresRating: boolean;
  status: "ACTIVE" | "PAUSED";
  options: DemoTaskOption[];
}

function optionsFor(taskId: string, texts: string[]): DemoTaskOption[] {
  return texts.map((text, index) => ({ id: `${taskId}-option-${index + 1}`, text }));
}

/** Три тренировочных задания. Первое — обязательное: подписка на Telegram-каналы. */
export const DEMO_TASKS: DemoTask[] = [
  {
    id: TELEGRAM_SUBSCRIPTION_TASK_ID,
    icon: "✈️",
    title: "Подписка на Telegram-каналы",
    description: "Подпишитесь на 3 Telegram-канала из задания.",
    conditions:
      "Нажмите «ПОДПИСАТЬСЯ» в каждой карточке и подпишитесь на канал. Подписка засчитывается только по данным Telegram: после подписки нажмите «ПРОВЕРИТЬ ПОДПИСКУ» — сервер сам проверит её через Bot API.",
    virtualTarget: "Telegram-каналы",
    type: TELEGRAM_SUBSCRIPTION_TASK_TYPE,
    reward: 330,
    minLength: 1,
    requiresRating: false,
    status: "ACTIVE",
    options: [],
  },
  {
    id: "task-restaurant",
    icon: "🍽",
    title: "Отзыв о ресторане",
    description: "Напишите тренировочный отзыв о виртуальном ресторане.",
    conditions:
      "Напишите виртуальный отзыв минимум на 25 символов. Опишите атмосферу и кухню условного ресторана.",
    virtualTarget: "ресторан",
    type: "SERVICE_FEEDBACK",
    reward: 420,
    minLength: 25,
    requiresRating: true,
    status: "ACTIVE",
    options: optionsFor("task-restaurant", [
      "Кухня на высоте, обязательно вернусь",
      "Вкусно, но ждали заказ долго",
      "Уютно и приятный персонал",
    ]),
  },
  {
    id: "task-product",
    icon: "🎧",
    title: "Отзыв о товаре",
    description: "Напишите тренировочный отзыв о виртуальной покупке.",
    conditions:
      "Напишите виртуальный отзыв минимум на 30 символов. Расскажите о качестве условного товара и доставке.",
    virtualTarget: "магазин электроники",
    type: "PRODUCT_FEEDBACK",
    reward: 500,
    minLength: 30,
    requiresRating: true,
    status: "ACTIVE",
    options: optionsFor("task-product", [
      "Звук отличный, шумоподавление работает",
      "Качество хорошее за свои деньги",
      "Пришли быстро, упаковка целая",
    ]),
  },
];

/** Задания для интерфейса: по возрастанию награды. */
export function listDemoTasks(): DemoTask[] {
  return [...DEMO_TASKS].filter((task) => task.status === "ACTIVE").sort((a, b) => a.reward - b.reward);
}

export function findDemoTask(id: string): DemoTask | null {
  return DEMO_TASKS.find((task) => task.id === id) ?? null;
}

/** Дедлайн «до 23:59»: сегодня, а если уже позже — завтра. */
export function resolveDeadline(now: Date = new Date()): Date {
  const deadline = new Date(now);
  deadline.setHours(23, 59, 0, 0);
  if (deadline.getTime() <= now.getTime()) {
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(23, 59, 0, 0);
  }
  return deadline;
}

/** Минимальная награда среди активных заданий. */
export function minimumReward(): number {
  const active = listDemoTasks();
  return active.length > 0 ? Math.min(...active.map((task) => task.reward)) : 0;
}
