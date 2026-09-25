import "server-only";

/**
 * ЕДИНЫЙ server-only слой доступа к базе данных.
 *
 * Весь серверный код приложения импортирует Prisma только отсюда:
 *   import { prisma } from "@/lib/db";
 *
 * Маркер `server-only` гарантирует, что модуль невозможно подключить из клиентского
 * компонента — сборка упадёт с понятной ошибкой (проверено).
 *
 * База данных — PostgreSQL (production: Neon). Клиент и driver adapter создаются
 * в `lib/prisma.ts`; смена провайдера затрагивает только этот файл и schema.prisma,
 * UI и API при этом не меняются.
 */
export { createPrismaClient, getDatabaseUrl, prisma } from "./prisma";
export type { PrismaClient } from "./prisma";

