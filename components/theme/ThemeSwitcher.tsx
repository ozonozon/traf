"use client";

import { Check, ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { hapticSelection } from "@/lib/telegram";
import { cn } from "@/lib/utils";

import { THEME_MODE_LABELS, useTheme, type ThemeMode } from "./theme-provider";

const MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const MODE_HINTS: Record<ThemeMode, string> = {
  system: "Как в Telegram или системе",
  light: "Всегда светлое оформление",
  dark: "Всегда тёмное оформление",
};

const MODE_ORDER: ThemeMode[] = ["light", "dark", "system"];

/** Пункт настроек «Тема»: текущий режим + bottom sheet выбора. */
export function ThemeSwitcherRow() {
  const { themeMode, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const CurrentIcon = MODE_ICONS[themeMode];

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Тема оформления: ${THEME_MODE_LABELS[themeMode]}`}
        onClick={() => {
          hapticSelection();
          setIsOpen(true);
        }}
        className="pressable flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
          <CurrentIcon size={19} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Тема</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">{THEME_MODE_LABELS[themeMode]}</span>
        </span>

        <ChevronRight size={18} className="shrink-0 text-muted" />
      </button>

      <BottomSheet
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Тема оформления"
        description="Выберите, как приложение будет выглядеть"
      >
        <ul className="space-y-2.5">
          {MODE_ORDER.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const isSelected = themeMode === mode;
            return (
              <li key={mode}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    hapticSelection();
                    setThemeMode(mode);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "pressable flex min-h-[60px] w-full items-center gap-3.5 rounded-[20px] border-2 p-3.5 text-left",
                    isSelected ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-[14px]",
                      isSelected ? "bg-primary text-white" : "bg-card-secondary text-muted",
                    )}
                  >
                    <Icon size={19} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[15px]", isSelected ? "font-bold text-primary" : "font-semibold")}>
                      {THEME_MODE_LABELS[mode]}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">{MODE_HINTS[mode]}</span>
                  </span>

                  {isSelected ? <Check size={20} strokeWidth={3} className="shrink-0 text-primary" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

/**
 * Компактная кнопка быстрой смены темы (шапка профиля).
 * Зона нажатия 44x44px, тема переключается между светлой и тёмной.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { themeMode, resolvedTheme, toggleTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        hapticSelection();
        toggleTheme();
      }}
      aria-label={`Переключить тему, сейчас: ${THEME_MODE_LABELS[themeMode]}`}
      title="Переключить тему"
      className={cn(
        "pressable flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground",
        className,
      )}
    >
      <Icon size={19} />
    </button>
  );
}
