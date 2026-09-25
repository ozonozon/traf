"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Мобильный bottom sheet (вместо desktop-диалогов).
 * Скругление 28px, учитывает safe-area снизу.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Блокируем прокрутку страницы классом (без inline-стилей body):
    // класс всегда снимается в cleanup, поэтому scroll не может «залипнуть».
    document.documentElement.classList.add("scroll-locked");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("scroll-locked");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-black/45"
      />
      <div className="animate-sheet-in relative mx-auto w-full max-w-[900px] overscroll-contain rounded-t-[28px] border border-border bg-card pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-nav">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-4 px-5">
          <div>
            <h3 className="text-[22px]">{title}</h3>
            {description ? <p className="mt-1.5 text-[14px] leading-snug text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
          >
            <X size={18} />
          </button>
        </div>
        {children ? <div className="mt-4 px-5">{children}</div> : null}
      </div>
    </div>
  );
}
