"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TransactionsSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSession } from "@/components/telegram/TelegramProvider";
import { isApiError, type ApiError } from "@/lib/api";
import type { TransactionDto, TransactionsResponseDto } from "@/lib/types";
import { cn, formatDate, formatSignedRub } from "@/lib/utils";

const PAGE_SIZE = 10;

/**
 * История виртуальных операций (+ начисления, − игровое использование).
 * Запросы идут через session.authedFetch: до завершения Telegram-авторизации
 * ни один запрос не отправляется, а 401 лечится повторным входом.
 */
export function TransactionList() {
  const session = useSession();
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const { isReady, version, authedFetch } = session;

  useEffect(() => {
    // Пока сессии нет — данные не запрашиваем, показываем скелетон.
    if (!isReady) return undefined;

    let cancelled = false;

    authedFetch<TransactionsResponseDto>(`/api/transactions?page=1&limit=${PAGE_SIZE}`)
      .then((response) => {
        if (cancelled) return;
        setTransactions(response.transactions);
        setPage(response.page);
        setHasMore(response.hasMore);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          isApiError(cause)
            ? cause
            : (Object.assign(new Error("Request failed"), { code: "REQUEST_FAILED", status: 0 }) as ApiError),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, version, authedFetch, nonce]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const response = await authedFetch<TransactionsResponseDto>(
        `/api/transactions?page=${page + 1}&limit=${PAGE_SIZE}`,
      );
      setTransactions((current) => [...current, ...response.transactions]);
      setPage(response.page);
      setHasMore(response.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function retry() {
    if (!isReady) session.retry();
    setIsLoading(true);
    setError(null);
    setNonce((value) => value + 1);
  }

  // Вход не удался — показываем ошибку с кнопкой повтора (она повторит авторизацию).
  if (!isReady) {
    if (session.status === "error") return <ErrorState onRetry={retry} />;
    return <TransactionsSkeleton count={4} />;
  }
  if (isLoading) return <TransactionsSkeleton count={4} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (transactions.length === 0) {
    return <EmptyState title="История пока пустая" description="Выполните задание — операция появится здесь." />;
  }

  return (
    <div>
      <ul className="card-surface divide-y divide-border overflow-hidden p-0">
        {transactions.map((transaction) => {
          const isEarn = transaction.type === "EARN";
          return (
            <li key={transaction.id} className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-[14px]",
                  isEarn ? "bg-success-soft text-success" : "bg-error-soft text-error",
                )}
              >
                {isEarn ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] leading-tight font-semibold">{transaction.description}</p>
                <p className="mt-1 text-[12px] leading-none text-muted">
                  {formatDate(transaction.createdAt)} · {isEarn ? "Успешно" : "Использование виртуальных рублей"}
                </p>
              </div>

              <p className={cn("shrink-0 text-[15px] font-extrabold", isEarn ? "text-success" : "text-foreground")}>
                {formatSignedRub(transaction.amount)}
              </p>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <Button variant="secondary" size="md" onClick={loadMore} isLoading={isLoadingMore} className="mt-3">
          Показать ещё
        </Button>
      ) : null}
    </div>
  );
}
