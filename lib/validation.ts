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

export type SubmissionInput = z.infer<typeof submissionSchema>;


/** Единый формат ошибок валидации для API. */
export function formatZodIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
