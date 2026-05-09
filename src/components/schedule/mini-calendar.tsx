"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameYMD(a: Date, b: Date) {
  return toYMD(a) === toYMD(b);
}

export type MiniCalendarProps = {
  month: Date;
  selected: Date;
  onMonthChange: (m: Date) => void;
  onSelect: (d: Date) => void;
  /** Dates (yyyy-mm-dd) that have at least one session */
  markedDates?: Set<string>;
  mode?: "mini" | "full";
  className?: string;
};

export function MiniCalendar({
  month,
  selected,
  onMonthChange,
  onSelect,
  markedDates,
  mode = "mini",
  className,
}: MiniCalendarProps) {
  const first = startOfMonth(month);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  const today = new Date();
  const label = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const isFull = mode === "full";

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="이전 달"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p
          className={cn(
            "font-semibold tabular-nums text-foreground",
            isFull ? "text-base" : "text-sm",
          )}
        >
          {label}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="다음 달"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div
        className={cn(
          "grid grid-cols-7 gap-1 text-center text-muted-foreground",
          isFull ? "text-xs" : "text-[11px]",
        )}
      >
        {weekdays.map((w) => (
          <div key={w} className="py-1 font-medium">
            {w}
          </div>
        ))}
      </div>
      <div className={cn("mt-1 grid grid-cols-7 gap-1", isFull && "gap-1.5")}>
        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div
                key={`e-${i}`}
                className={cn("aspect-square", isFull && "min-h-12")}
              />
            );
          }
          const isToday = sameYMD(cell, today);
          const isSelected = sameYMD(cell, selected);
          const ymd = toYMD(cell);
          const marked = markedDates?.has(ymd);

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelect(cell)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                isFull && "min-h-12 text-base",
                "hover:bg-surface-hover",
                isSelected &&
                  "bg-accent text-accent-foreground hover:bg-accent/90",
                !isSelected && isToday && "ring-1 ring-accent/50",
                !isSelected && !isToday && "text-foreground",
              )}
            >
              <span className="relative inline-flex">
                {cell.getDate()}
                {marked && !isSelected && (
                  <span className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent/80" />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        · 표시: 일정이 있는 날짜(골드 점). 달력은 날짜 선택용입니다.
      </p>
    </div>
  );
}

export { toYMD };
