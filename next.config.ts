import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Серверные пакеты не включаются в бандл приложения:
   * pg (драйвер PostgreSQL) и @prisma/adapter-pg — driver adapter Prisma 7.
   * Клиентского кода это не касается: Prisma доступна только из server-only слоя.
   */
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
