"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notification";
import { notificationTypeLabels } from "@/types/notification";

export function NotificationDetail({
  item,
  onBack,
  scheduleHref,
}: {
  item: NotificationItem;
  onBack: () => void;
  scheduleHref: string;
}) {
  const Icon =
    item.type === "application_approved"
      ? CheckCircle2
      : item.type === "application_rejected"
        ? XCircle
        : UserPlus;

  const rows: { label: string; value: string }[] = [
    { label: "이벤트명", value: item.eventTitle || "—" },
    { label: "날짜", value: item.eventDate || "—" },
    { label: "시간대", value: item.slotTime || "—" },
    { label: "매장", value: item.location || "—" },
    {
      label: "신청 시간",
      value: item.createdAt
        ? new Date(item.createdAt).toLocaleString("ko-KR", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "—",
    },
  ];

  if (item.type === "application_submitted") {
    rows.splice(4, 0, {
      label: "신청자",
      value:
        [item.applicantName, item.applicantEmail].filter(Boolean).join(" · ") ||
        "—",
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onBack}
          aria-label="목록으로"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">알림 상세</h3>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              "mb-3 flex size-14 items-center justify-center rounded-full border border-border bg-muted/50",
              item.type === "application_approved" && "text-emerald-400",
              item.type === "application_rejected" && "text-red-400",
              item.type === "application_submitted" && "text-accent",
            )}
          >
            <Icon className="size-7" />
          </div>
          <p className="text-base font-semibold">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {notificationTypeLabels[item.type]} · {formatRelativeTime(item.createdAt)}
          </p>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-center text-sm text-muted-foreground">
          {item.message}
        </p>

        <dl className="mt-6 space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t border-border pt-4">
        <Button variant="accent" className="w-full" asChild>
          <Link href={scheduleHref} onClick={onBack}>
            관련 일정 보기
          </Link>
        </Button>
      </div>
    </div>
  );
}
