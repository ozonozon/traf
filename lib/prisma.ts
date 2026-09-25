import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

/**
 * НИЗКОУРОВНЕВЫЙ слой доступа к БД (raw Prisma Client) — PostgreSQL (production: Neon).
 *
 * ⚠️ Код приложения должен импортировать `@/lib/db` — он помечен `server-only`
 * и физически не может попасть в клиентский бандл. Этот модуль намеренно НЕ помечен
 * маркером `server-only`, потому что его использует CLI-скрипт `prisma/seed.ts`
 * (обычный Node/tsx, где `server-only` бросает исключение).
 *
 * Строка подключения берётся ТОЛЬКО из переменной окружения `DATABASE_URL`
 * (никаких захардкоженных connection string):
 *   - production/Vercel: DATABASE_URL из Neon (лучше pooled-строка, sslmode=require);
 *   - локально: свой Postgres (например, docker) в DATABASE_URL.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      [
        "[db] Не задан DATABASE_URL.",
        "Укажите строку подключения PostgreSQL, например:",
        '  DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"',
        "Локально можно поднять Postgres в docker и указать его в DATABASE_URL.",
      ].join("\n"),
    );
  }
  return url;
}

/** Приложение работает только с PostgreSQL: SQLite больше не поддерживается. */
function assertPostgresUrl(url: string): void {
  if (/^postgres(ql)?:\/\//i.test(url)) return;

  throw new Error(
    [
      '[db] DATABASE_URL должен быть строкой подключения PostgreSQL (postgresql://…).',
      "SQLite (file:…) в этом проекте больше не используется: datasource provider = \"postgresql\".",
      "Production использует Neon PostgreSQL, локально подойдёт любой Postgres.",
    ].join("\n"),
  );
}

const globalForPrisma = globalThis as unknown as { voxyPrisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl();
  assertPostgresUrl(url);

  // Пул соединений pg (для Neon — pooled-строка; sslmod из URL соблюдается драйвером).
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

/**
 * Клиент создаётся ЛЕНИВО — при первом обращении к БД.
 * Поэтому `next build` не требует DATABASE_URL, а понятная ошибка конфигурации
 * появляется только в момент реального запроса (а не при импорте модуля).
 */
function resolveClient(): PrismaClient {
  if (globalForPrisma.voxyPrisma) return globalForPrisma.voxyPrisma;

  const created = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.voxyPrisma = created;
  }
  return created;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = resolveClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return property in resolveClient();
  },
});

export type { PrismaClient };

