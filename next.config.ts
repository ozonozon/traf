import type { NextConfig } from "next";

/**
 * MVP-конфигурация без ORM: доступ к PostgreSQL идёт через `pg` из server-only модуля.
 *
 * `pg` остаётся внешним пакетом (`serverExternalPackages`): у него есть условный
 * `require('pg-native')`, который bundler не может разрешить, а на Vercel зависимости
 * трассируются в serverless-функцию как есть.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default nextConfig;

