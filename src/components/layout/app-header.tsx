"use client";

import { NotificationsCenter } from "@/components/notifications/notifications-center";
import { cn } from "@/lib/utils";

/** PC 메인 영역 상단 — 알림 종 아이콘 */
export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background/80 px-6 backdrop-blur md:flex",
        className,
      )}
    >
      <NotificationsCenter />
    </header>
  );
}
