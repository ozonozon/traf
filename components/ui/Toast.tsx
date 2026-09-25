"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastApi {
  show: (title: string, options?: { description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { accent: string; dot: string }> = {
  default: { accent: "border-border", dot: "bg-primary" },
  success: { accent: "border-success/40", dot: "bg-success" },
  error: { accent: "border-error/40", dot: "bg-error" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback<ToastApi["show"]>((title, options) => {
    const id = Date.now() + Math.random();
    setItems((current) => [
      ...current.slice(-2),
      { id, title, description: options?.description, variant: options?.variant ?? "default" },
    ]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(102px+env(safe-area-inset-bottom,0px))] z-[80] mx-auto flex w-full max-w-[900px] flex-col items-center gap-2 px-5"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "animate-toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[20px] border bg-card px-4 py-3 shadow-card",
              VARIANT_STYLES[item.variant].accent,
            )}
          >
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", VARIANT_STYLES[item.variant].dot)} />
            <div className="min-w-0">
              <p className="text-[15px] leading-tight font-bold">{item.title}</p>
              {item.description ? <p className="mt-1 text-[13px] leading-tight text-muted">{item.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast должен использоваться внутри ToastProvider");
  }
  return context;
}
