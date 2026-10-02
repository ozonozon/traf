import type { NextConfig } from "next";

/**
 * MVP-конфигурация без ORM: доступ к PostgreSQL идёт через `pg` из server-only модуля.
 * Пакет не бандлится, а подключается как внешний модуль — его нативные части не ломают сборку.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default nextConfig;

