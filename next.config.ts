import type { NextConfig } from "next";

/**
 * MVP-конфигурация без внешних сервисов.
 *
 * Дополнительных настроек не требуется: нет БД-драйверов, нет внешних серверных
 * пакетов, нет `images.remotePatterns` (аватары Telegram — обычные <img> с внешним URL).
 */
const nextConfig: NextConfig = {};

export default nextConfig;

