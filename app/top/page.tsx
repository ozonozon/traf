"use client";

import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";

/** Экран «Топ»: ТОП-30 участников платформы. */
export default function TopPage() {
  return (
    <AppFrame>
      <AppHeader />

      <main className="px-5 pt-6 pb-[calc(104px+env(safe-area-inset-bottom,0px))]">
        <h1 className="text-[clamp(38px,11vw,48px)] leading-none font-extrabold tracking-[-0.035em]">Рейтинг</h1>

        <p className="mt-3.5 max-w-[340px] text-[15px] leading-snug text-muted">
          ТОП-30 участников нашей платформы, которые заработали больше всего
        </p>

        <div className="mt-4">
          <LeaderboardList />
        </div>
      </main>
    </AppFrame>
  );
}
