import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Скелетон карточки задания. */
export function TaskCardSkeleton() {
  return (
    <div className="card-surface flex items-center gap-3.5 p-4">
      <Skeleton className="size-12 rounded-[16px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function TaskListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <TaskCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-[22px]" />
        ))}
      </div>
      <div className="mt-5 flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="card-surface divide-y divide-border overflow-hidden p-0">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TransactionsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="card-surface divide-y divide-border overflow-hidden p-0">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-[14px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
