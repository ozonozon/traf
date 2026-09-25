// Конфигурация Prisma CLI (Prisma 7).
//
// URL подключения берётся ТОЛЬКО из переменной окружения DATABASE_URL
// (production/Vercel — строка Neon PostgreSQL, локально — свой Postgres).
// Никаких фолбэков и захардкоженных строк: если DATABASE_URL не задан,
// env() из prisma/config падает с понятной ошибкой, называя переменную.
//
// .env не подхватывается Prisma автоматически (в отличие от Next.js),
// поэтому подключаем dotenv — локально он читает .env, на Vercel просто no-op.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // datasource.url обязателен для migrate deploy / migrate dev / seed / studio.
  datasource: {
    url: env("DATABASE_URL"),
  },
});


