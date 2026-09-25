// Конфигурация Prisma CLI (Prisma 7).
//
// URL подключения берётся ТОЛЬКО из переменной окружения DATABASE_URL
// (production — строка Neon PostgreSQL, локально — свой Postgres).
// .env не подхватывается автоматически, поэтому подключаем dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"]?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  // datasource нужен командам migrate/seed/studio.
  // `prisma generate` работает и без него, поэтому URL добавляем только когда он задан.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});

