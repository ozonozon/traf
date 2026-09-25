import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "./generated/prisma/client";

/**
 * НИЗКОУРОВНЕВЫЙ слой доступа к БД (raw Prisma Client).
 *
 * ⚠️ Код приложения должен импортировать `@/lib/db` — он помечен `server-only`
 * и физически не может попасть в клиентский бандл. Этот модуль намеренно НЕ помечен
 * маркером `server-only`, потому что его использует CLI-скрипт `prisma/seed.ts`
 * (обычный Node/tsx, где `server-only` бросает исключение).
 *
 * Строка подключения берётся ТОЛЬКО из переменной окружения `DATABASE_URL`
 * (в коде не захардкожена):
 *   - локальная разработка: DATABASE_URL="file:./prisma/dev.db";
 *   - production: см. README «Деплой на Vercel» (Turso/libSQL или PostgreSQL).
 */
const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

/**
 * Текущая schema объявлена как `provider = "sqlite"`, поэтому поддерживается
 * только файловая SQLite/libSQL. Для другого провайдера нужен осознанный переход,
 * а не «тихая» ошибка на прод-сервере.
 */
function assertSupportedDatabaseUrl(url: string): void {
  if (url.startsWith("file:")) return;

  throw new Error(
    [
      `[db] DATABASE_URL="${url}" не поддерживается текущей Prisma schema (provider = "sqlite").`,
      "Варианты production-подключения:",
      '  1) Turso/libSQL: установите @prisma/adapter-libsql и задайте DATABASE_URL="libsql://…";',
      '  2) PostgreSQL/Supabase: смените provider в prisma/schema.prisma на "postgresql",',
      "     установите @prisma/adapter-pg и замените адаптер ниже.",
      'Локально используйте DATABASE_URL="file:./prisma/dev.db".',
    ].join("\n"),
  );
}

const globalForPrisma = globalThis as unknown as { voxyPrisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl();
  assertSupportedDatabaseUrl(url);

  // Смена провайдера = замена одной строки: new PrismaPg({ connectionString: url })
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.voxyPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.voxyPrisma = prisma;
}

export type { PrismaClient };
