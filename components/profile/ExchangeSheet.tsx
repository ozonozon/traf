"use client";

import { Gift, Sparkles, Trophy } from "lucide-react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { copy } from "@/config/branding";

const OPTIONS = [
  { icon: Gift, title: "Обменять на бонус", description: "Игровой бонус к следующему заданию" },
  { icon: Sparkles, title: "Обменять на уровень", description: "Повышение внутриигрового уровня" },
  { icon: Trophy, title: "Обменять на виртуальный приз", description: "Косметический приз в профиле" },
] as const;

/** Bottom sheet «Виртуальные рубли». Реального вывода средств не существует. */
export function ExchangeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Виртуальные рубли"
      description="Баланс используется только внутри приложения."
    >
      <ul className="space-y-2.5">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.title}>
              <button
                type="button"
                onClick={() => {
                  toast.show("Функция скоро будет доступна", {
                    description: "Обмен виртуальных рублей появится в следующих версиях",
                  });
                  onClose();
                }}
                className="pressable flex w-full items-center gap-3.5 rounded-[20px] border border-border bg-card p-3.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{option.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{option.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[12px] leading-snug text-muted">
        Реального вывода средств нет: это тренировочный симулятор, {copy.currencyName} нельзя обменять на деньги.
      </p>
    </BottomSheet>
  );
}
