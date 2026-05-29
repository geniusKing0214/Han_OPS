"use client";

import { NotificationCard } from "@/components/notifications/notification-card";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notification";

export function NotificationList({
  items,
  loading,
  onSelect,
  onDelete,
  className,
}: {
  items: NotificationItem[];
  loading?: boolean;
  onSelect: (item: NotificationItem) => void;
  onDelete?: (item: NotificationItem) => void;
  className?: string;
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
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <NotificationCard
          key={item.id}
          item={item}
          onClick={() => onSelect(item)}
          onDelete={onDelete ? () => onDelete(item) : undefined}
        />
      ))}
    </div>
  );
}
