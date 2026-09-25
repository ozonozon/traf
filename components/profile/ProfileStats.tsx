import { formatAmount, formatRub } from "@/lib/utils";
import type { ProfileStatsDto } from "@/lib/types";

/** Статистика профиля: задания, заработок, сегодня, место в рейтинге. */
export function ProfileStats({ stats }: { stats: ProfileStatsDto }) {
  const items = [
    { label: "Заданий", value: formatAmount(stats.completedTasks) },
    { label: "Заработано", value: formatRub(stats.totalEarned) },
    { label: "Сегодня", value: formatAmount(stats.completedToday) },
    { label: "В рейтинге", value: `#${formatAmount(stats.rank)}` },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="rounded-[22px] border border-border bg-card-secondary p-4">
          <p className="text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">{item.label}</p>
          <p className="mt-1.5 text-[22px] leading-none font-extrabold tracking-[-0.02em]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
