"use client";

import {
  Calendar,
  CheckCircle2,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notification";
import {
  notificationStatusBadgeVariant,
  notificationTypeLabels,
} from "@/types/notification";

function iconForType(type: NotificationItem["type"]): LucideIcon {
  switch (type) {
    case "application_submitted":
      return UserPlus;
    case "application_approved":
      return CheckCircle2;
    case "application_rejected":
      return XCircle;
    default:
      return Calendar;
  }
}

export function NotificationCard({
  item,
  compact,
  onClick,
}: {
  item: NotificationItem;
  compact?: boolean;
  onClick?: () => void;
}) {
  const Icon = iconForType(item.type);
  const timeLabel = formatRelativeTime(item.createdAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-lg border border-border bg-card/80 text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        !item.isRead && "border-accent/25 bg-accent/5",
      )}
    >
      {!item.isRead ? (
        <span
          className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-accent"
          aria-hidden
        />
      ) : null}

      <div className={cn("flex gap-3", !item.isRead && "pl-2")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/50",
            compact ? "size-8" : "size-9",
          )}
        >
          <Icon
            className={cn(
              "size-4",
              item.type === "application_approved" && "text-emerald-400",
              item.type === "application_rejected" && "text-red-400",
              item.type === "application_submitted" && "text-accent",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-sm font-medium text-foreground">
              {item.title}
            </p>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {timeLabel}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.message}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={notificationStatusBadgeVariant[item.type]}
              className="text-[10px]"
            >
              {notificationTypeLabels[item.type]}
            </Badge>
            {item.eventTitle ? (
              <span className="line-clamp-1 text-[11px] text-muted-foreground">
                {item.eventTitle}
                {item.eventDate ? ` · ${item.eventDate}` : ""}
                {item.slotTime ? ` ${item.slotTime}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
