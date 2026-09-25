import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Каркас приложения: mobile-first, на desktop максимум 900px по центру. */
export function AppFrame({
  children,
  withGrid = false,
  className,
}: {
  children: ReactNode;
  withGrid?: boolean;
  className?: string;
}) {
  return <div className={cn("app-frame", withGrid && "grid-background", className)}>{children}</div>;
}

/** Отступ снизу под фиксированную навигацию + safe-area. */
export const NAV_SPACING = "pb-[calc(104px+env(safe-area-inset-bottom,0px))]";
