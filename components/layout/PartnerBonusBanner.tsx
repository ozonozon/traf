"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

/** Длительность бонусного предложения: ровно 2 часа. */
const BONUS_SECONDS = 2 * 60 * 60;

/** Обратный отсчёт в формате HH:MM:SS. */
function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

/**
 * Компактная красная плашка в самом верху приложения.
 * Таймер стартует с 02:00:00, каждую секунду уменьшается и останавливается на 00:00:00.
 */
export function PartnerBonusBanner() {
  const [secondsLeft, setSecondsLeft] = useState(BONUS_SECONDS);
  const isFinished = secondsLeft === 0;

  useEffect(() => {
    if (isFinished) return undefined;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isFinished]);

  return (
    <div className="safe-top bg-error-soft">
      <div className="flex items-center gap-2 px-4 py-1.5 text-[11.5px] leading-tight font-semibold text-error">
        <Clock size={12} className="shrink-0" />
        <p className="min-w-0 flex-1">Бонус от партнёра — выполни задания и получи дополнительные 1000 ₽</p>
        <span className="shrink-0 rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-bold tabular-nums">
          {formatCountdown(secondsLeft)}
        </span>
      </div>
    </div>
  );
}
