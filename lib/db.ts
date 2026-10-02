import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Простой доступ к PostgreSQL через `pg` — без ORM и без слоя репозиториев.
 *
 * Пул создаётся ЛЕНИВО: во время `next build` ни одного соединения не открывается,
 * подключение появляется только при первом запросе в runtime API-роутов.
 * DATABASE_URL читается только здесь (server-only) и никогда не логируется.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL не настроен");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Neon и другие облачные базы требуют TLS; локальный Postgres — без него.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query<T>(text, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * DDL схемы приложения.
 *
 * Канонический источник — `scripts/init-db.sql` (для ручного запуска `npm run db:init`).
 * Здесь та же идемпотентная схема продублирована для runtime: сервер сам создаёт недостающие
 * таблицы при первом обращении к базе. Без этого на «чистой» production-базе (например,
 * свежий Neon без прогона `db:init`) любой запрос падал с relation "users" does not exist —
 * и статистика, рейтинг, профиль и авторизация не работали. При изменении схемы правьте
 * оба файла.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  balance         INTEGER NOT NULL DEFAULT 0,
  total_earned    INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  photo_url       TEXT,
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_total_earned_idx ON users (total_earned DESC);

CREATE TABLE IF NOT EXISTS channel_requests (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  channel_id   TEXT NOT NULL,
  invite_link  TEXT,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, channel_id)
);

CREATE INDEX IF NOT EXISTS channel_requests_telegram_idx ON channel_requests (telegram_id);

CREATE TABLE IF NOT EXISTS task_completions (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  task_id      TEXT NOT NULL,
  reward       INTEGER NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, task_id)
);

CREATE INDEX IF NOT EXISTS task_completions_telegram_idx ON task_completions (telegram_id, completed_at);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_telegram_idx ON transactions (telegram_id, created_at DESC);
`;

let schemaReady: Promise<void> | null = null;

/**
 * Проверяет/создаёт схему один раз на процесс (DDL идемпотентный).
 * При ошибке соединения результат сбрасывается, чтобы следующая попытка повторила DDL.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }

  return schemaReady;
}


/** Транзакция на одном соединении: при ошибке выполняется ROLLBACK. */
export async function withTransaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// --- Типы строк -------------------------------------------------------------

export interface UserRow {
  id: number;
  /** BIGINT приходит из pg строкой — это сохраняет точность. */
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  balance: number;
  total_earned: number;
  completed_tasks: number;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TaskCompletionRow {
  reward: number;
  completed_at: Date;
}

export interface TransactionRow {
  id: number;
  amount: number;
  type: string;
  description: string | null;
  created_at: Date;
}

export interface LeaderboardRow {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  total_earned: number;
  completed_tasks: number;
}

const USER_COLUMNS =
  "id, telegram_id::text AS telegram_id, username, first_name, last_name, photo_url, balance, total_earned, completed_tasks, is_demo, created_at, updated_at";

// --- Пользователи -----------------------------------------------------------

/**
 * Создаёт пользователя или обновляет его профиль из Telegram.
 * INSERT ... ON CONFLICT (telegram_id) DO UPDATE — дубликатов не появляется.
 */
export async function upsertUser(input: {
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  isDemo?: boolean;
}): Promise<UserRow> {
  const rows = await query<UserRow>(
    `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, is_demo)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (telegram_id) DO UPDATE
        SET username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            photo_url = EXCLUDED.photo_url,
            updated_at = NOW()
     RETURNING ${USER_COLUMNS}`,
    [input.telegramId, input.username, input.firstName, input.lastName, input.photoUrl, input.isDemo ?? false],
  );

  return rows[0];
}

export async function getUserByTelegramId(telegramId: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE telegram_id = $1`, [telegramId]);
}

/** Данные для профиля: сколько заданий выполнено сегодня, место в рейтинге, всего пользователей. */
export async function getProfileStats(telegramId: string): Promise<{
  completedToday: number;
  rank: number;
  totalUsers: number;
}> {
  const rows = await query<{ completed_today: string; rank: string; total_users: string }>(
    `SELECT
       (SELECT COUNT(*) FROM task_completions
         WHERE telegram_id = $1 AND completed_at >= date_trunc('day', NOW()))::text AS completed_today,
       (SELECT COUNT(*) + 1 FROM users
         WHERE total_earned > COALESCE((SELECT total_earned FROM users WHERE telegram_id = $1), 0))::text AS rank,
       (SELECT COUNT(*) FROM users)::text AS total_users`,
    [telegramId],
  );

  const row = rows[0];
  return {
    completedToday: Number(row?.completed_today ?? 0),
    rank: Number(row?.rank ?? 1),
    totalUsers: Number(row?.total_users ?? 0),
  };
}

// --- Заявки на вступление в каналы -------------------------------------------

/**
 * Записывает заявку, полученную Telegram (chat_join_request).
 * Повторная заявка по тому же каналу ничего не меняет: UNIQUE(telegram_id, channel_id).
 */
export async function addChannelRequest(input: {
  telegramId: string;
  channelId: string;
  inviteLink: string | null;
}): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `INSERT INTO channel_requests (telegram_id, channel_id, invite_link)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, channel_id) DO NOTHING
     RETURNING id`,
    [input.telegramId, input.channelId, input.inviteLink],
  );

  return rows.length > 0;
}

/** id каналов, по которым пользователь уже отправил заявку. */
export async function getRequestedChannelIds(telegramId: string): Promise<string[]> {
  const rows = await query<{ channel_id: string }>(
    `SELECT channel_id FROM channel_requests WHERE telegram_id = $1`,
    [telegramId],
  );
  return rows.map((row) => row.channel_id);
}

// --- Выполненные задания -----------------------------------------------------

export async function getCompletedTaskIds(telegramId: string): Promise<string[]> {
  const rows = await query<{ task_id: string }>(
    `SELECT task_id FROM task_completions WHERE telegram_id = $1`,
    [telegramId],
  );
  return rows.map((row) => row.task_id);
}

export async function getTaskCompletion(telegramId: string, taskId: string): Promise<TaskCompletionRow | null> {
  return queryOne<TaskCompletionRow>(
    `SELECT reward, completed_at FROM task_completions WHERE telegram_id = $1 AND task_id = $2`,
    [telegramId, taskId],
  );
}

/**
 * Начисление вознаграждения за задание в одной транзакции:
 * task_completions + transactions + balance/total_earned/completed_tasks.
 * Повторное начисление невозможно: UNIQUE(telegram_id, task_id) + DO NOTHING.
 */
export async function completeTask(input: {
  telegramId: string;
  taskId: string;
  reward: number;
  description: string;
}): Promise<{ created: boolean; user: UserRow | null }> {
  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO task_completions (telegram_id, task_id, reward)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id, task_id) DO NOTHING
       RETURNING id`,
      [input.telegramId, input.taskId, input.reward],
    );

    if (inserted.rowCount === 0) {
      return { created: false, user: null };
    }

    await client.query(
      `INSERT INTO transactions (telegram_id, amount, type, description)
       VALUES ($1, $2, 'EARN', $3)`,
      [input.telegramId, input.reward, input.description],
    );

    const updated = await client.query<UserRow>(
      `UPDATE users
          SET balance = balance + $2,
              total_earned = total_earned + $2,
              completed_tasks = completed_tasks + 1,
              updated_at = NOW()
        WHERE telegram_id = $1
        RETURNING ${USER_COLUMNS}`,
      [input.telegramId, input.reward],
    );

    return { created: true, user: updated.rows[0] ?? null };
  });
}

// --- История операций, рейтинг, статистика платформы --------------------------

export async function getTransactions(
  telegramId: string,
  limit: number,
  offset: number,
): Promise<{ items: TransactionRow[]; total: number }> {
  const rows = await query<TransactionRow & { total: string }>(
    `SELECT id, amount, type, description, created_at, COUNT(*) OVER ()::text AS total
       FROM transactions
      WHERE telegram_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [telegramId, limit, offset],
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      description: row.description,
      created_at: row.created_at,
    })),
    total: Number(rows[0]?.total ?? 0),
  };
}

/** ТОП по заработку: реальные пользователи из базы (демо-заполнение помечено флагом is_demo). */
export async function getLeaderboard(limit: number): Promise<{ entries: LeaderboardRow[]; total: number }> {
  const rows = await query<LeaderboardRow & { total: string }>(
    `SELECT telegram_id::text AS telegram_id, username, first_name, last_name, photo_url,
            total_earned, completed_tasks, COUNT(*) OVER ()::text AS total
       FROM users
      ORDER BY total_earned DESC, created_at ASC
      LIMIT $1`,
    [limit],
  );

  return {
    entries: rows.map((row) => ({
      telegram_id: row.telegram_id,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      photo_url: row.photo_url,
      total_earned: row.total_earned,
      completed_tasks: row.completed_tasks,
    })),
    total: Number(rows[0]?.total ?? 0),
  };
}

/** Место пользователя в рейтинге и общее число участников. */
export async function getUserRank(telegramId: string): Promise<{ rank: number; total: number }> {
  const row = await queryOne<{ rank: string; total: string }>(
    `SELECT
       (SELECT COUNT(*) + 1 FROM users
         WHERE total_earned > COALESCE((SELECT total_earned FROM users WHERE telegram_id = $1), 0))::text AS rank,
       (SELECT COUNT(*) FROM users)::text AS total`,
    [telegramId],
  );

  return { rank: Number(row?.rank ?? 1), total: Number(row?.total ?? 0) };
}

/** Статистика главного экрана — считается по реальным данным базы. */
export async function getPlatformStats(): Promise<{ participants: number; totalBonuses: number }> {
  const row = await queryOne<{ participants: string; total_bonuses: string }>(
    `SELECT COUNT(*)::text AS participants, COALESCE(SUM(total_earned), 0)::text AS total_bonuses FROM users`,
  );

  return {
    participants: Number(row?.participants ?? 0),
    totalBonuses: Number(row?.total_bonuses ?? 0),
  };
}
