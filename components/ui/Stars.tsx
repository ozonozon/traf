"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Пять интерактивных звёзд. Любая оценка 1–5 допустима, «5» не выставляется автоматически. */
export function Stars({
  value,
  onChange,
  size = 36,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const current = value ?? 0;

  return (
    <div className="flex items-center gap-2.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= current;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={`Оценка ${star}`}
            aria-pressed={active}
            onClick={() => onChange?.(star)}
            className={cn("pressable flex items-center justify-center", readOnly && "cursor-default")}
          >
            <Star
              size={size}
              fill={active ? "currentColor" : "none"}
              strokeWidth={active ? 0 : 1.7}
              className={active ? "text-primary" : "text-star"}
            />
          </button>
        );
      })}
    </div>
  );
}
