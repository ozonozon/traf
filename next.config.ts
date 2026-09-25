import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Серверные/нативные пакеты не включаются в бандл приложения:
   * better-sqlite3 — нативный драйвер SQLite (локальная разработка),
   * @prisma/adapter-better-sqlite3 — driver adapter для него.
   * Клиентского кода это не касается: Prisma доступна только из server-only слоя.
   */
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
