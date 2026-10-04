import "server-only";

import {
  claimFollowupStep,
  claimPeriodicFollowup,
  getCompletedTaskIds,
  listFollowupTargets,
  releaseFollowupStep,
  startFollowupChain,
  stopFollowupChain,
} from "./db";
import { listDemoTasks } from "./demo-data";
import { sendMiniAppMessage } from "./telegram-bot";

/**
 * Цепочка автоматических добивающих сообщений после /start.
 *
 * Механика (совместима с serverless/Vercel, без setTimeout внутри роутов):
 *  1) /start ставит пользователю цепочку: 5 отложенных сообщений + периодическое (15 ч);
 *  2) воркер `drainFollowupMessages()` отправляет всё, что уже просрочено:
 *     его вызывает Vercel Cron (`/api/telegram/followups`) и webhook на каждом апдейте;
 *  3) каждая отправка помечается в БД (`sent_at`), поэтому повторный прогон и
 *     повторный вебхук не отправляют одно и то же сообщение дважды;
 *  4) когда все задания выполнены, цепочка останавливается и сообщения больше не уходят;
 *  5) если бот не может писать пользователю (403, «chat not found»), цепочка тоже
 *     останавливается — ошибка не всплывает наружу и не ломает webhook.
 *
 * Тексты и интервалы сообщений — предметные, меняются только по согласованию.
 */
export const FOLLOWUP_STEPS = [
  {
    step: "step_1_3m",
    delayMinutes: 3,
    text: "300₽ ЗА ПОДПИСКУ НА ТГ-КАНАЛЫ!💸 Открывай приложение и забирай свои деньги",
  },
  {
    step: "step_2_10m",
    delayMinutes: 10,
    text: "⚡1000₽ СГОРЯТ ЧЕРЕЗ 15 МИНУТ! Успей выполнить задания и забрать дополнительные 1000₽ на свой баланс",
  },
  {
    step: "step_3_15m",
    delayMinutes: 15,
    text: "❗️ТЫ НЕ ЗАБРАЛ СВОИ ДЕНЬГИ❗️ Задания уже доступны. Выполняешь — получаешь начисление. Чем раньше начнёшь, тем раньше заберёшь",
  },
  {
    step: "step_4_2h",
    delayMinutes: 120,
    text: "💸 1000₽ В ДВУХ КЛИКАХ ОТ ТЕБЯ. Открой приложение, выполни задание и забери их!",
  },
  {
    step: "step_5_4h",
    delayMinutes: 240,
    text: "❗️ОСТАЛОСЬ 15 МИНУТ❗️Успей выполнить задания и забрать свои 2000₽",
  },
] as const;

/** Периодическое сообщение каждые 15 часов: одно на пользователя, без дублей задач. */
export const PERIODIC_FOLLOWUP = {
  step: "periodic_15h",
  hours: 15,
  text: "⚡ДОБАВИЛИ НОВЫЕ ЗАДАНИЯ НА 3.000₽⚡Успей открыть приложения и забрать их, пока они еще доступны",
} as const;

/** Сколько пользователей обрабатывается за один прогон воркера. */
export const FOLLOWUP_BATCH_LIMIT = 25;

/** Публичный HTTPS-адрес Mini App (тот же, что в кнопке «Открыть» у /start). */
export function resolveMiniAppUrl(): string | null {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  return appUrl.startsWith("https://") ? appUrl : null;
}

/** Все ли задания выполнены (по существующей истории из task_completions). */
function areAllTasksDone(completedTaskIds: string[]): boolean {
  const taskIds = listDemoTasks().map((task) => task.id);
  return taskIds.length > 0 && taskIds.every((id) => completedTaskIds.includes(id));
}

/**
 * Запуск цепочки после /start. Идемпотентно: повторный /start не создаёт дубликаты
 * и не перезапускает отсчёт. Никогда не бросает исключение — /start не должен падать.
 */
export async function startFollowupChainFor(telegramId: number | string): Promise<void> {
  try {
    await startFollowupChain(
      String(telegramId),
      FOLLOWUP_STEPS.map((item) => ({ step: item.step, delayMinutes: item.delayMinutes })),
      PERIODIC_FOLLOWUP.hours,
    );
  } catch (error) {
    console.error("[followups] не удалось создать цепочку:", error instanceof Error ? error.name : "unknown");
  }
}

export interface FollowupDrainResult {
  /** Сколько пользователей с готовыми к отправке сообщениями просмотрено. */
  processed: number;
  sent: number;
  stopped: number;
  blocked: number;
  skipped: number;
}

/**
 * Отправляет всё, что просрочено. Одно сообщение на пользователя за прогон
 * (без «пачки» сообщений и без дублей). Ошибки наружу не выбрасываются.
 */
export async function drainFollowupMessages(limit: number = FOLLOWUP_BATCH_LIMIT): Promise<FollowupDrainResult> {
  const stats: FollowupDrainResult = { processed: 0, sent: 0, stopped: 0, blocked: 0, skipped: 0 };

  const appUrl = resolveMiniAppUrl();
  if (!appUrl) {
    // Без корректного адреса Mini App кнопки отправлять нельзя — сообщения не уйдут «в никуда».
    console.error("[followups] NEXT_PUBLIC_APP_URL не настроен: рассылка пропущена");
    return stats;
  }

  let targets: Awaited<ReturnType<typeof listFollowupTargets>>;
  try {
    targets = await listFollowupTargets(limit);
  } catch (error) {
    console.error("[followups] не удалось получить список цепочек:", error instanceof Error ? error.name : "unknown");
    return stats;
  }

  for (const target of targets) {
    stats.processed += 1;
    const telegramId = target.telegram_id;

    // Задания выполнены → старую цепочку прекращаем и молчим.
    const completedTaskIds = await getCompletedTaskIds(telegramId).catch(() => [] as string[]);
    if (areAllTasksDone(completedTaskIds)) {
      await stopFollowupChain(telegramId, "ALL_TASKS_COMPLETED").catch(() => undefined);
      stats.stopped += 1;
      continue;
    }

    const step = FOLLOWUP_STEPS.find((item) => item.step === target.due_step) ?? null;
    const isPeriodic = !step && target.periodic_due;

    if (!step && !isPeriodic) {
      stats.skipped += 1;
      continue;
    }

    // Атомарный «клейм»: одно сообщение — одна отправка, даже при параллельных прогонах.
    const claimed = step
      ? await claimFollowupStep(telegramId, step.step).catch(() => false)
      : await claimPeriodicFollowup(telegramId, PERIODIC_FOLLOWUP.hours).catch(() => false);

    if (!claimed) {
      stats.skipped += 1;
      continue;
    }

    const text = step ? step.text : PERIODIC_FOLLOWUP.text;
    const outcome = await sendMiniAppMessage(telegramId, text, appUrl).catch(() => ({
      outcome: "transient" as const,
      details: "unexpected error",
    }));

    if (outcome.outcome === "sent") {
      stats.sent += 1;
    } else if (outcome.outcome === "blocked") {
      // Бот не может писать пользователю — цепочку закрываем, повторов не будет.
      await stopFollowupChain(telegramId, outcome.details ?? "BLOCKED", true).catch(() => undefined);
      stats.blocked += 1;
    } else if (step) {
      // Временная ошибка: возвращаем шаг в очередь (с ограничением попыток).
      await releaseFollowupStep(telegramId, step.step, outcome.details ?? "TRANSIENT").catch(() => undefined);
      stats.skipped += 1;
    } else {
      stats.skipped += 1;
    }
  }

  return stats;
}
