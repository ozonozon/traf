/**
 * Генератор demo-участников рейтинга (ботов).
 *
 * «Плоский» модуль без обращения к БД и без `server-only`, поэтому его использует
 * серверный слой `lib/demo-data.ts`.
 * Никаких реальных людей: имена/username собираются из заранее заданных пулов,
 * а одинаковый результат на одинаковом seed даёт детерминированный LCG.
 */

export interface RandomSource {
  int: (min: number, max: number) => number;
  pick: <T>(values: T[]) => T;
}

/** Детерминированный LCG — чтобы seed давал одинаковые данные при каждом запуске. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed % 4294967296;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (values) => values[Math.floor(next() * values.length) % values.length],
  };
}

export const MOCK_NAMES = {
  first: [
    "Алексей", "Максим", "Дарья", "Иван", "Кира", "Артём", "Кирилл", "Милана", "Дмитрий", "Сергей",
    "Виталий", "Анна", "Данил", "Анастасия", "Пётр", "Ольга", "Максим", "Ксения", "Егор", "Полина",
    "Никита", "София", "Роман", "Елена", "Тимур", "Вера", "Илья", "Мария", "Глеб", "Алина",
  ],
  last: [
    "Кравцов", "Ерёмин", "Тонина", "Рогов", "Папин", "Рыбаков", "Морозова", "Ковалёв", "Волкова", "Петров",
    "Соколов", "Медведев", "Иванова", "Лебедев", "Орлова", "Захаров", "Гусев", "Фомина", "Белов", "Крылова",
  ],
  usernames: [
    "alex", "max", "dasha", "ivan", "kira", "milana", "rogov", "vitaly", "ann", "danil",
    "nastya", "petr", "kirill", "lyosha", "olga", "shadow", "kseniya", "egor", "polina", "timur",
    "vera", "ilya", "maria", "gleb", "alina", "nikita", "sofia", "roman", "elena", "artem",
  ],
} as const;

export interface MockProfile {
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  totalEarned: number;
  completedTasks: number;
}

/** Профиль demo-участника: явно сгенерированные данные, без реальных людей. */
export function generateMockProfile(
  random: RandomSource,
  options: { telegramId: string; totalEarned: number },
): MockProfile {
  const firstName = random.pick([...MOCK_NAMES.first]);
  const lastName = random.pick([...MOCK_NAMES.last]);
  const base = random.pick([...MOCK_NAMES.usernames]);
  const suffix = random.pick(["", "_pro", "_work", "_ru", "_dev", `_${random.int(100, 999)}`]);
  const username = `${base}${suffix}`.slice(0, 24);

  return {
    telegramId: options.telegramId,
    username,
    firstName,
    lastName,
    totalEarned: options.totalEarned,
    completedTasks: Math.max(1, Math.round(options.totalEarned / random.int(180, 420))),
  };
}
