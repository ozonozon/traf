"use client";

import { useApi } from "@/lib/hooks";
import type { StatsResponseDto } from "@/lib/types";
import { formatBonusAmount, formatRub } from "@/lib/utils";

import { StatsSkeleton } from "@/components/ui/Skeleton";

interface StatCard {
  value: string;
  label: string;
}

/**
 * Статистика главного экрана: две акцентные карточки (primary-soft) и под ними
 * центрированный блок выплаченных бонусов. Данные — из GET /api/stats.
 */
export function TaskStats() {
  const { data, isLoading, error, refresh } = useApi<StatsResponseDto>("/api/stats");

  if (isLoading) return <StatsSkeleton />;

  if (error || !data) {
    return (
      <div className="card-surface flex items-center justify-between gap-3 rounded-[22px] px-4 py-3.5">
        <p className="text-[13px] text-muted">Не удалось загрузить статистику</p>
        <button type="button" onClick={refresh} className="pressable text-[13px] font-bold text-primary">
          Повторить
        </button>
      </div>
    );
  }

  const cards: StatCard[] = [
    { value: String(data.participantsCount), label: "участников" },
    { value: `от ${formatRub(data.minimumReward)}`, label: "за задание" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[22px] border border-primary/20 bg-primary-soft px-3 py-4 text-center"
          >
            <p className="text-[20px] leading-tight font-extrabold tracking-[-0.02em] text-primary">{card.value}</p>
            <p className="text-[11.5px] leading-tight text-muted">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
        <p className="text-[27px] leading-none font-extrabold tracking-[-0.03em] text-primary">
          {formatBonusAmount(data.totalBonuses)}
        </p>
        <p className="text-[13.5px] leading-none text-muted">выплачено бонусов</p>
      </div>
    </div>
  );
}


