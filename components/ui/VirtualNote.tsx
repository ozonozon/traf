import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Пояснительная плашка: всё внутри — тренировочная симуляция. */
export function VirtualNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[18px] border border-border bg-surface px-3.5 py-3", className)}>
      <Info size={16} className="mt-0.5 shrink-0 text-primary" />
      <p className="text-[12.5px] leading-snug text-muted">{children}</p>
    </div>
  );
}
