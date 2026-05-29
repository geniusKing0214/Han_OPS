"use client";

import { NotificationCard } from "@/components/notifications/notification-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NotificationItem } from "@/types/notification";

export function NotificationList({
  items,
  loading,
  onSelect,
  maxHeightClass = "max-h-[min(420px,70dvh)]",
}: {
  items: NotificationItem[];
  loading?: boolean;
  onSelect: (item: NotificationItem) => void;
  maxHeightClass?: string;
}) {
  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        불러오는 중...
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        알림이 없습니다.
      </p>
    );
  }

  return (
    <ScrollArea className={maxHeightClass}>
      <div className="space-y-2 p-1 pr-3">
        {items.map((item) => (
          <NotificationCard
            key={item.id}
            item={item}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
