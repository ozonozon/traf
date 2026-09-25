"use client";

import { useSession } from "@/components/telegram/TelegramProvider";
import { cn, formatBalance } from "@/lib/utils";

/** Плашка с ВИРТУАЛЬНЫМ балансом пользователя. */
export function BalancePill({ className }: { className?: string }) {
  const { user, isLoading } = useSession();

  if (isLoading && !user) {
    return <div className="skeleton h-10 w-[88px] rounded-full" />;
  }

  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-primary-soft px-3.5 py-2.5 text-[15px] leading-none font-extrabold text-primary",
        className,
      )}
    >
      {formatBalance(user?.balance ?? 0)}
    </div>
  );
}
