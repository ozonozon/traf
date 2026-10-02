-- PayDoEarn: схема базы (PostgreSQL).
-- Скрипт идемпотентный: его можно запускать повторно (CREATE TABLE IF NOT EXISTS).

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

-- Для баз, созданных более ранней версией схемы: добавляем поля, если их ещё нет.
-- photo_url — аватар из Telegram (нужен интерфейсу), is_demo — явный флаг
-- демонстрационного заполнения (у реальных пользователей всегда FALSE).
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_total_earned_idx ON users (total_earned DESC);

-- Заявки на вступление в закрытые Telegram-каналы (только реальные chat_join_request).
CREATE TABLE IF NOT EXISTS channel_requests (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  channel_id   TEXT NOT NULL,
  invite_link  TEXT,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, channel_id)
);

CREATE INDEX IF NOT EXISTS channel_requests_telegram_idx ON channel_requests (telegram_id);

-- Выполненные задания: UNIQUE не даёт начислить одно задание дважды.
CREATE TABLE IF NOT EXISTS task_completions (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  task_id      TEXT NOT NULL,
  reward       INTEGER NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, task_id)
);

CREATE INDEX IF NOT EXISTS task_completions_telegram_idx ON task_completions (telegram_id, completed_at);

-- История виртуальных операций.
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_telegram_idx ON transactions (telegram_id, created_at DESC);
