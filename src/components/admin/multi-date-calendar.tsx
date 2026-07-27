"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MultiDateCalendar({
  month,
  onMonthChange,
  selectedDates,
  onToggleDate,
}: {
  month: Date;
  onMonthChange: (m: Date) => void;
  /** yyyy-mm-dd 형식의 선택된 날짜 집합 */
  selectedDates: Set<string>;
  /** 날짜 클릭 시 선택/해제 토글 */
  onToggleDate: (ymd: string) => void;
}) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay(); // 0=일
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayYMD = toYMD(new Date());

  const cells: Array<{ ymd: string; day: number } | null> = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { ymd: toYMD(new Date(y, m, day)), day };
    }),
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {/* 월 네비게이션 */}
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onMonthChange(new Date(y, m - 1, 1))}
          aria-label="이전 달"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {y}년 {m + 1}월
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onMonthChange(new Date(y, m + 1, 1))}
          aria-label="다음 달"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {DOW.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`e-${i}`} className="aspect-square" />;
          }
          const { ymd, day } = cell;
          const isSelected = selectedDates.has(ymd);
          const isToday = ymd === todayYMD;

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onToggleDate(ymd)}
              className={cn(
                "aspect-square rounded-md text-sm tabular-nums transition-colors",
                "hover:bg-muted/60",
                isSelected &&
                  "bg-accent font-semibold text-accent-foreground hover:bg-accent/90",
                !isSelected && isToday && "ring-1 ring-accent/60",
                !isSelected && "text-foreground",
              )}
              aria-pressed={isSelected}
              aria-label={`${y}년 ${m + 1}월 ${day}일${isSelected ? " (선택됨)" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        날짜를 클릭해 선택 / 다시 클릭해 해제
      </p>
    </div>
  );
}
