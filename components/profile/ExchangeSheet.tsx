"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/branding";
import { hapticNotification, openExternalLink } from "@/lib/telegram";

/** Ссылка на менеджера для вопросов по выводу. */
const MANAGER_URL = "https://goo.su/qndatD";

/** Сколько «подготавливаем вывод» перед показом ошибки. */
const PREPARING_MS = 1800;

type WithdrawState = "preparing" | "error";

/**
 * Bottom sheet «Вывод средств».
 *
 * Сначала короткое состояние подготовки, затем красное состояние ошибки с кнопкой
 * «Написать менеджеру». Реальных платежей и финансовых операций нет и не добавляется.
 */
export function ExchangeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<WithdrawState>("preparing");
  const [wasOpen, setWasOpen] = useState(open);

  // Каждое открытие меню начинается заново с подготовки (корректировка состояния
  // при изменении пропа, без setState внутри эффекта).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setState("preparing");
  }

  useEffect(() => {
    if (!open || state !== "preparing") return undefined;

    const timer = setTimeout(() => {
      setState("error");
      hapticNotification("error");
    }, PREPARING_MS);

    return () => clearTimeout(timer);
  }, [open, state]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Вывод средств"
      description="Проверяем возможность вывода виртуального баланса."
    >
      {state === "preparing" ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-border bg-surface px-5 py-8 text-center">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-[15.5px] font-bold">Подготавливаем вывод...</p>
          <p className="text-[12.5px] leading-snug text-muted">Не закрывайте окно, это займёт несколько секунд.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-error/40 bg-error-soft px-5 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-error/15 text-error">
            <TriangleAlert size={26} />
          </div>
          <p className="text-[15.5px] leading-snug font-bold text-error">
            Вывод виртуальных рублей сейчас недоступен.
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-1"
            onClick={() => {
              openExternalLink(MANAGER_URL);
            }}
          >
            Написать менеджеру
          </Button>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-snug text-muted">
        Реального вывода средств нет: это тренировочный симулятор, {copy.currencyName} нельзя обменять на деньги.
      </p>
    </BottomSheet>
  );
}

