"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { formatRub } from "@/lib/utils";

/** Экран успешного выполнения задания (виртуальное вознаграждение). */
export function TaskSuccess({
  reward,
  answer,
  isFresh,
}: {
  reward: number;
  answer: string;
  isFresh: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3.5">
      <div className="card-surface flex flex-col items-center gap-3 px-5 py-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          {isFresh ? <Sparkles size={30} /> : <CheckCircle2 size={30} />}
        </div>

        <h2 className="text-[24px]">{isFresh ? "Задание выполнено" : "Задание уже выполнено"}</h2>

        <p className="text-[34px] leading-none font-extrabold text-primary">+{formatRub(reward)}</p>
        <p className="text-[13px] font-semibold text-success">
          {isFresh ? "Баланс обновлён · виртуальные рубли" : "Вознаграждение уже начислено"}
        </p>

        {answer ? (
          <div className="mt-2 w-full rounded-[18px] border border-border bg-surface p-3.5 text-left">
            <p className="text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">Ваш ответ</p>
            <p className="mt-1.5 text-[14px] leading-snug">{answer}</p>
          </div>
        ) : null}
      </div>

      <Button onClick={() => router.push("/tasks")}>Вернуться к заданиям</Button>
      <Button variant="secondary" onClick={() => router.push("/profile")}>
        Открыть профиль
      </Button>
    </div>
  );
}
