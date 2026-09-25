/**
 * Демонстрационные данные MVP.
 *
 * Никакой БД: задания и участники рейтинга лежат в коде, а «ежедневная динамика»
 * выводится детерминированно из календарной даты (seed = дата). Поэтому:
 *  - значения одинаковы для всех пользователей внутри дня;
 *  - повторные запросы и обновление страницы ничего не меняют (идемпотентно);
 *  - каждый новый день значения немного растут — без записи в базу.
 *
 * Это осознанный компромисс MVP: данные виртуальные и демонстрационные.
 */

import { TELEGRAM_SUBSCRIPTION_TASK_TYPE } from "./task-constants";
import { createSeededRandom, generateMockProfile, type RandomSource } from "./mock-users";

// --- Задания ---------------------------------------------------------------

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

/** Три тренировочных задания. Первое — подписка на Telegram-каналы (проверка на сервере). */
export const DEMO_TASKS: DemoTask[] = [
  {
    id: "task-telegram-subscription",
    icon: "✈️",
    title: "Подписка на Telegram-каналы",
    description:
      "Подпишитесь на 3 Telegram-канала и отправьте заявки на вступление. После проверки подписок задание будет засчитано.",
    conditions:
      "Подпишитесь на 3 Telegram-канала и отправьте заявки на вступление. После проверки подписок задание будет засчитано.",
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

/** Задания для интерфейса: по возрастанию награды (как раньше в списке). */
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

export function minimumReward(): number {
  const active = listDemoTasks();
  return active.length > 0 ? Math.min(...active.map((task) => task.reward)) : 0;
}

// --- Дата-хелперы ----------------------------------------------------------

/**
 * Дата запуска MVP: в этот день статистика равна стартовым значениям,
 * дальше растёт на 20–50 участников и 15 000–25 000 бонусов в сутки.
 */
const APP_EPOCH = Date.UTC(2026, 8, 25); // 2026-09-25
const MAX_SIMULATED_DAYS = 730;

function dayIndex(date: Date, epochMs: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const dateMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((dateMs - epochMs) / dayMs);
  if (diff <= 0) return 0;
  return Math.min(diff, MAX_SIMULATED_DAYS);
}

/** Количество суток с даты запуска (0 — день запуска). */
export function daysSinceEpoch(date: Date = new Date()): number {
  return dayIndex(date, APP_EPOCH);
}

// --- Публичная статистика (участники / бонусы) -----------------------------

export const INITIAL_PARTICIPANTS = 2344;
export const INITIAL_TOTAL_BONUSES = 2_235_890;

const PARTICIPANTS_STEP = { min: 20, max: 50 } as const;
const BONUS_STEP = { min: 15_000, max: 25_000 } as const;
const STATS_SEED = 20260925;

export interface DailyAppStats {
  participantsCount: number;
  totalBonuses: number;
}

/** Статистика главного экрана: стартовые значения + детерминированный прирост за каждый прошедший день. */
export function getDailyAppStats(date: Date = new Date()): DailyAppStats {
  let participantsCount = INITIAL_PARTICIPANTS;
  let totalBonuses = INITIAL_TOTAL_BONUSES;

  for (let day = 1; day <= daysSinceEpoch(date); day += 1) {
    const random = createSeededRandom(STATS_SEED + day);
    participantsCount += random.int(PARTICIPANTS_STEP.min, PARTICIPANTS_STEP.max);
    totalBonuses += random.int(BONUS_STEP.min, BONUS_STEP.max);
  }

  return { participantsCount, totalBonuses };
}

// --- Рейтинг: демонстрационные участники ------------------------------------

export interface DemoBot {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  totalEarned: number;
  completedTasks: number;
}

/** 16 «заметных» участников — фиксированные данные (стабильный вид ТОП-30). */
const FEATURED_BOTS: DemoBot[] = [
  { id: "bot-001", username: "Rappthbx", firstName: "Артём", lastName: "Кравцов", totalEarned: 28940, completedTasks: 74 },
  { id: "bot-002", username: "krezx1", firstName: "Кирилл", lastName: "Ерёмин", totalEarned: 26780, completedTasks: 68 },
  { id: "bot-003", username: "milotonina", firstName: "Милана", lastName: "Тонина", totalEarned: 24560, completedTasks: 61 },
  { id: "bot-004", username: "rogov12_45", firstName: "Дмитрий", lastName: "Рогов", totalEarned: 21130, completedTasks: 55 },
  { id: "bot-005", username: "Спайпер", firstName: "Сергей", lastName: "Папин", totalEarned: 18760, completedTasks: 49 },
  { id: "bot-006", username: "vitaly_ry", firstName: "Виталий", lastName: "Рыбаков", totalEarned: 16240, completedTasks: 42 },
  { id: "bot-007", username: "morozova_ann", firstName: "Анна", lastName: "Морозова", totalEarned: 14890, completedTasks: 38 },
  { id: "bot-008", username: "danil_k", firstName: "Данил", lastName: "Ковалёв", totalEarned: 12340, completedTasks: 33 },
  { id: "bot-009", username: "nastya_v", firstName: "Анастасия", lastName: "Волкова", totalEarned: 10760, completedTasks: 29 },
  { id: "bot-010", username: "petrov_p", firstName: "Пётр", lastName: "Петров", totalEarned: 9120, completedTasks: 25 },
  { id: "bot-011", username: "kirill_99", firstName: "Кирилл", lastName: "Соколов", totalEarned: 7840, completedTasks: 21 },
  { id: "bot-012", username: "lyosha_m", firstName: "Алексей", lastName: "Медведев", totalEarned: 6320, completedTasks: 18 },
  { id: "bot-013", username: "ivanova_olga", firstName: "Ольга", lastName: "Иванова", totalEarned: 5180, completedTasks: 15 },
  { id: "bot-014", username: "shadowfox", firstName: "Максим", lastName: "Лебедев", totalEarned: 4260, completedTasks: 12 },
  { id: "bot-015", username: "orlova_k", firstName: "Ксения", lastName: "Орлова", totalEarned: 3140, completedTasks: 9 },
  { id: "bot-016", username: "zaharov", firstName: "Егор", lastName: "Захаров", totalEarned: 2210, completedTasks: 7 },
];

const MID_TIER_COUNT = 82;
const LOW_TIER_COUNT = 12;
const BASE_BOTS_SEED = 20260924;
const LEADERBOARD_SEED = 20260925;

const DAILY_SHARE_PERCENT = { min: 10, max: 25 } as const;
const DAILY_BONUS = { min: 500, max: 1_000 } as const;
const NEW_USERS_PER_DAY = { min: 2, max: 4 } as const;
const NEW_USER_EARNINGS = { min: 5_000, max: 12_000 } as const;
/** «Низкий» пул: участники ниже уровня реального пользователя (двигают его позицию). */
const LOW_TIER_MAX = 400;
const LOW_TIER_EARNINGS = { min: 80, max: 350 } as const;
const LOW_TIER_POOL_MIN = 8;

function pickMany<T>(random: RandomSource, values: T[], count: number): T[] {
  const pool = [...values];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
  }
  return picked;
}

/** Базовый состав рейтинга: 16 фиксированных + средний пул + низкий пул. */
function buildBaseBots(): DemoBot[] {
  const random = createSeededRandom(BASE_BOTS_SEED);
  const bots: DemoBot[] = [...FEATURED_BOTS];

  for (let index = 0; index < MID_TIER_COUNT + LOW_TIER_COUNT; index += 1) {
    const isLowTier = index >= MID_TIER_COUNT;
    const profile = generateMockProfile(random, {
      telegramId: `9100${String(index + 1).padStart(6, "0")}`,
      totalEarned: isLowTier ? random.int(60, 340) : random.int(500, 2_000),
    });

    bots.push({
      id: profile.telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      totalEarned: profile.totalEarned,
      completedTasks: profile.completedTasks,
    });
  }

  return bots;
}

const BASE_BOTS = buildBaseBots();

/**
 * Участники рейтинга на дату: базовый состав + детерминированные изменения за
 * каждый прошедший день (10–25% получают +500…1000, добавляется 2–4 новых).
 * Значения одинаковы для всех пользователей и не меняются в течение дня.
 */
export function getLeaderboardBots(date: Date = new Date()): DemoBot[] {
  const bots: DemoBot[] = BASE_BOTS.map((bot) => ({ ...bot }));

  for (let day = 1; day <= daysSinceEpoch(date); day += 1) {
    const random = createSeededRandom(LEADERBOARD_SEED + day);

    const sharePercent = random.int(DAILY_SHARE_PERCENT.min, DAILY_SHARE_PERCENT.max);
    const winners = pickMany(random, bots, Math.max(1, Math.round((bots.length * sharePercent) / 100)));
    for (const winner of winners) {
      winner.totalEarned += random.int(DAILY_BONUS.min, DAILY_BONUS.max);
      winner.completedTasks += 1;
    }

    const totalNew = random.int(NEW_USERS_PER_DAY.min, NEW_USERS_PER_DAY.max);
    const lowPool = bots.filter((bot) => bot.totalEarned < LOW_TIER_MAX).length;
    const lowNeeded = lowPool < LOW_TIER_POOL_MIN ? Math.min(totalNew, LOW_TIER_POOL_MIN - lowPool) : 0;

    for (let index = 0; index < totalNew; index += 1) {
      const range = index < lowNeeded ? LOW_TIER_EARNINGS : NEW_USER_EARNINGS;
      const profile = generateMockProfile(random, {
        telegramId: `9${day}${index}${1000 + random.int(0, 999)}`,
        totalEarned: random.int(range.min, range.max),
      });

      bots.push({
        id: profile.telegramId,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        totalEarned: profile.totalEarned,
        completedTasks: profile.completedTasks,
      });
    }
  }

  return bots;
}



