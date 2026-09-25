import { z } from "zod";

/** Тело запроса авторизации через Telegram WebApp. */
export const telegramAuthSchema = z.object({
  initData: z.string().max(4096).optional().default(""),
  startParam: z.string().max(256).optional(),
});

/** Отправка выполненного задания. userId и reward НИКОГДА не принимаются с фронтенда. */
export const submissionSchema = z.object({
  taskId: z.string().min(1).max(64),
  /** Для заданий TELEGRAM_SUBSCRIPTION текст не нужен — решение принимает backend. */
  answer: z.string().max(2000).optional().default(""),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  selectedOptionId: z.string().min(1).max(64).nullable().optional(),
});

/** Пагинация для leaderboard / transactions / admin-выборок. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Задание: создание/обновление через admin API. */
export const adminTaskSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(3).max(1000),
  conditions: z.string().min(3).max(1000),
  virtualTarget: z.string().min(2).max(120),
  type: z
    .enum([
      "REVIEW_SIMULATION",
      "SURVEY",
      "PRODUCT_FEEDBACK",
      "SERVICE_FEEDBACK",
      "USER_RESEARCH",
      "PHOTO_SIMULATION",
      "TEXT_TASK",
      "OTHER",
    ])
    .default("REVIEW_SIMULATION"),
  icon: z.string().min(1).max(16),
  reward: z.number().int().min(0).max(100000),
  minLength: z.number().int().min(1).max(2000).default(20),
  deadline: z.coerce.date(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "EXPIRED"]).default("ACTIVE"),
  requiresModeration: z.boolean().default(false),
  requiresRating: z.boolean().default(true),
  options: z.array(z.string().min(1).max(400)).max(10).default([]),
});

export const adminTaskUpdateSchema = adminTaskSchema.partial();

export type SubmissionInput = z.infer<typeof submissionSchema>;
export type AdminTaskInput = z.infer<typeof adminTaskSchema>;

/** Единый формат ошибок валидации для API. */
export function formatZodIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
