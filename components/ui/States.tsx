"use client";

import { Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";

/** Пустое состояние (например, нет новых заданий). */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Inbox size={26} />}
      </div>
      <p className="text-[17px] font-bold">{title}</p>
      {description ? <p className="max-w-[280px] text-[14px] leading-snug text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/** Ошибка загрузки данных без stack trace и без alert(). */
export function ErrorState({
  title = "Не удалось загрузить данные",
  description = "Попробуйте еще раз",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-error-soft text-error">
        <TriangleAlert size={26} />
      </div>
      <p className="text-[17px] font-bold">{title}</p>
      <p className="max-w-[280px] text-[14px] leading-snug text-muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="md" fullWidth={false} onClick={onRetry} className="mt-1">
          <RefreshCw size={17} />
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
