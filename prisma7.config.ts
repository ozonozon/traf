// Конфигурация Prisma CLI (Prisma 7+).
// URL подключения берётся из DATABASE_URL (schema.prisma -> env("DATABASE_URL")).
// .env не подхватывается автоматически, поэтому подключаем dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./prisma/dev.db",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
