/*
 * Инициализация базы PayDoEarn: создаёт таблицы (scripts/init-db.sql) и заполняет
 * демонстрационных участников рейтинга. Запуск: npm run db:init
 *
 * Скрипт идемпотентный: повторный запуск не создаёт дубликатов и не сбрасывает балансы.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Простейшая подгрузка .env (без зависимостей): значения из окружения приоритетнее. */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(join(root, ".env"));

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URL не задан. Укажите строку подключения Neon в .env или в переменных окружения.");
  process.exit(1);
}

// Демонстрационное заполнение рейтинга: помечено флагом is_demo, чтобы не смешивать
// с реальными пользователями Telegram.
const DEMO_NAMES = [
  ["Артём", "Кравцов"], ["Кирилл", "Ерёмин"], ["Милана", "Тонина"], ["Дмитрий", "Рогов"],
  ["Сергей", "Папин"], ["Виталий", "Рыбаков"], ["Анна", "Морозова"], ["Данил", "Ковалёв"],
  ["Анастасия", "Волкова"], ["Пётр", "Петров"], ["Кирилл", "Соколов"], ["Алексей", "Медведев"],
  ["Ольга", "Иванова"], ["Максим", "Лебедев"], ["Ксения", "Орлова"], ["Егор", "Захаров"],
  ["Полина", "Гусева"], ["Никита", "Фомин"], ["София", "Белова"], ["Роман", "Крылов"],
];

/** Детерминированный генератор: одинаковые демо-данные при каждом запуске. */
function seededRandom(seed) {
  let state = seed % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = seededRandom(20260925);
const demoUsers = [];

// 16 «заметных» участников с фиксированным заработком.
const featuredEarnings = [28940, 26780, 24560, 21130, 18760, 16240, 14890, 12340, 10760, 9120, 7840, 6320, 5180, 4260, 3140, 2210];
const usernames = ["alex", "max", "dasha", "ivan", "kira", "milana", "rogov", "vitaly", "ann", "danil", "nastya", "petr", "kirill", "lyosha", "olga", "shadow"];

for (let i = 0; i < featuredEarnings.length; i += 1) {
  const [first, last] = DEMO_NAMES[i % DEMO_NAMES.length];
  demoUsers.push({
    telegramId: String(910000000 + i),
    username: usernames[i],
    firstName: first,
    lastName: last,
    earned: featuredEarnings[i],
  });
}

// Остальные — средний и низкий диапазон, как в демо-рейтинге приложения.
for (let i = 0; i < 104; i += 1) {
  const [first, last] = DEMO_NAMES[(i + 5) % DEMO_NAMES.length];
  const earned = i < 92 ? 500 + Math.floor(random() * 1500) : 60 + Math.floor(random() * 300);
  demoUsers.push({
    telegramId: String(920000000 + i),
    username: `user${100 + i}`,
    firstName: first,
    lastName: last,
    earned,
  });
}

const client = new pg.Client({ connectionString, ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false } });

try {
  await client.connect();

  await client.query(readFileSync(join(root, "scripts", "init-db.sql"), "utf8"));
  console.log("Схема создана (users, channel_requests, task_completions, transactions).");

  for (const user of demoUsers) {
    await client.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, total_earned, completed_tasks, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [user.telegramId, user.username, user.firstName, user.lastName, user.earned, Math.max(1, Math.round(user.earned / 300))],
    );
  }
  console.log(`Демо-участники: ${demoUsers.length} (флаг is_demo = TRUE, повторный запуск их не дублирует).`);

  const demoId = process.env.DEMO_TELEGRAM_ID || "999000001";
  const demo = await client.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, balance, total_earned, is_demo)
     VALUES ($1, 'demo_user', 'Игорь', 'Рябов', 360, 360, TRUE)
     ON CONFLICT (telegram_id) DO NOTHING
     RETURNING id`,
    [demoId],
  );
  if (demo.rowCount > 0) {
    await client.query(
      `INSERT INTO transactions (telegram_id, amount, type, description)
       VALUES ($1, 360, 'EARN', 'Стартовый виртуальный баланс')`,
      [demoId],
    );
  }
  console.log("Демо-пользователь локальной разработки готов (telegram_id = " + demoId + ").");

  const counts = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE is_demo) AS demo_users,
       (SELECT COUNT(*) FROM channel_requests) AS channel_requests,
       (SELECT COUNT(*) FROM task_completions) AS completions,
       (SELECT COUNT(*) FROM transactions) AS transactions`,
  );
  console.log("Итог:", counts.rows[0]);
} catch (error) {
  console.error("Не удалось инициализировать базу:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
