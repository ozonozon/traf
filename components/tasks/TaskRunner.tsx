"use client";

import { useState } from "react";

import { copy } from "@/config/branding";

import { useSession } from "@/components/telegram/TelegramProvider";
import { Button } from "@/components/ui/Button";
import { Stars } from "@/components/ui/Stars";
import { useToast } from "@/components/ui/Toast";
import { VirtualNote } from "@/components/ui/VirtualNote";
import { apiFetch, isApiError } from "@/lib/api";
import { hapticNotification, hapticSelection } from "@/lib/telegram";
import type { SubmissionResponseDto, TaskDetailDto } from "@/lib/types";
import { cn, formatRub, getErrorMessage, plural } from "@/lib/utils";

import { TaskSuccess } from "./TaskSuccess";

/** Форма выполнения тренировочного задания: вариант ответа, свой текст, оценка. */
export function TaskRunner({ task }: { task: TaskDetailDto }) {
  const toast = useToast();
  const { setUser } = useSession();

  const [answer, setAnswer] = useState(task.submission?.answer ?? "");
  const [rating, setRating] = useState<number | null>(task.submission?.rating ?? null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    task.submission?.selectedOptionId ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reward, setReward] = useState<number | null>(
    task.state === "completed" ? (task.submission?.reward ?? task.reward) : null,
  );
  const [isFresh, setIsFresh] = useState(false);

  const trimmed = answer.trim();
  const charsLeft = Math.max(0, task.minLength - trimmed.length);
  const isLengthOk = trimmed.length >= task.minLength;
  const isRatingOk = !task.requiresRating || rating !== null;
  const isDisabled = !isLengthOk || !isRatingOk || isSubmitting;

  function handleSelectOption(optionId: string, text: string) {
    hapticSelection();
    setSelectedOptionId(optionId);
    // Выбранный вариант подставляется в textarea и остаётся редактируемым.
    setAnswer(text);
  }

  async function handleSubmit() {
    if (isDisabled) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch<SubmissionResponseDto>("/api/submissions", {
        json: {
          taskId: task.id,
          answer: trimmed,
          rating: task.requiresRating ? rating : null,
          selectedOptionId,
        },
      });
      setUser(response.user);
      setReward(response.reward);
      setIsFresh(true);
      hapticNotification("success");
      toast.show("Задание выполнено", {
        description: `+${formatRub(response.reward)} добавлено · виртуально`,
        variant: "success",
      });
    } catch (cause) {
      const code = isApiError(cause) ? cause.code : "REQUEST_FAILED";
      hapticNotification("error");
      toast.show("Не удалось выполнить задание", {
        description: getErrorMessage(code),
        variant: "error",
      });
      if (code === "TASK_ALREADY_COMPLETED") {
        setReward(task.reward);
        setIsFresh(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reward !== null) {
    return <TaskSuccess reward={reward} answer={answer} isFresh={isFresh} />;
  }

  return (
    <div className="space-y-3.5">
      {task.options.length > 0 ? (
        <section className="card-surface p-5">
          <h2 className="text-[17px]">Выберите один вариант</h2>
          <div className="mt-3.5 space-y-2.5">
            {task.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectOption(option.id, option.text)}
                  className={cn(
                    "pressable flex w-full items-center justify-between gap-3 rounded-[18px] border-2 p-3.5 text-left",
                    isSelected ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <span className={cn("text-[15px] leading-snug", isSelected ? "font-bold" : "font-medium")}>
                    {option.text}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      isSelected ? "border-primary" : "border-border",
                    )}
                  >
                    {isSelected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card-surface p-5">
        <h2 className="text-[17px]">Или напишите свой отзыв</h2>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Свой отзыв..."
          rows={5}
          className="mt-3.5 w-full rounded-[18px] border border-border bg-card px-4 py-3.5 text-[15px] leading-snug outline-none transition-colors placeholder:text-muted focus:border-primary"
        />
        <p className={cn("mt-2 text-[13px] font-semibold", isLengthOk ? "text-success" : "text-muted")}>
          {isLengthOk
            ? "Минимальная длина выполнена"
            : `Осталось: ${charsLeft} ${plural(charsLeft, "символ", "символа", "символов")}.`}
        </p>
      </section>

      {task.requiresRating ? (
        <section className="card-surface p-5">
          <h2 className="text-[17px]">Ваша оценка</h2>
          <p className="mt-1.5 text-[13px] text-muted">Любая оценка от 1 до 5 — на выбор</p>
          <div className="mt-3.5">
            <Stars
              value={rating}
              onChange={(value) => {
                hapticSelection();
                setRating(value);
              }}
            />
          </div>
        </section>
      ) : null}

      <VirtualNote>{copy.virtualMoneyNotice}</VirtualNote>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[900px] border-t border-border bg-card/95 px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <Button onClick={handleSubmit} disabled={isDisabled} isLoading={isSubmitting}>
          {isLengthOk && isRatingOk ? "Получить вознаграждение" : "Выполнить задание"}
        </Button>
      </div>
    </div>
  );
}
