"use client";

import { CircleUserRound, Layers, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { hapticSelection } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/tasks", label: "Задания", icon: Layers },
  { href: "/top", label: "Топ", icon: Trophy },
  { href: "/profile", label: "Профиль", icon: CircleUserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // На экране задания нижняя навигация скрыта: там своя фиксированная CTA.
  if (/^\/tasks\/[^/]+$/.test(pathname)) return null;

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[900px] rounded-t-[30px] border-t border-border bg-nav shadow-nav"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-3">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => hapticSelection()}
                className={cn(
                  "pressable flex min-h-[52px] flex-col items-center justify-center gap-1.5 pt-3 pb-2.5",
                  isActive ? "text-primary" : "text-muted",
                )}
              >
                <Icon size={25} strokeWidth={isActive ? 2.4 : 2} />
                <span className={cn("text-[11px] leading-none", isActive ? "font-bold" : "font-semibold")}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
