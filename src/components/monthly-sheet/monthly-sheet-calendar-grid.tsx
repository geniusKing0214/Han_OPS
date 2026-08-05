"use client";

import { cn } from "@/lib/utils";
import type { SheetDayBundle } from "@/types/monthly-sheet";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameYmd(a: Date, b: Date) {
  return toYmd(a) === toYmd(b);
}

/** 날짜 셀에 표시할 스케줄 수 · 미확인 신청 수 */
function getCellCounts(bundle: SheetDayBundle | undefined) {
  const scheduleCount = bundle?.rows.length ?? 0;
  const pendingCount =
    bundle?.rows.reduce(
      (sum, row) =>
        sum +
        row.applicants.filter((a) => a.status === "pending").length,
      0,
    ) ?? 0;
  return { scheduleCount, pendingCount };
}

export function MonthlySheetCalendarGrid({
  month,
  selected,
  onSelect,
  days,
  className,
}: {
  month: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  days: Map<string, SheetDayBundle>;
  className?: string;
}) {
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

  const renderCell = (cell: Date | null, i: number) => {
    if (!cell) {
      return (
        <div
          key={`empty-${i}`}
          className="min-h-[76px] min-w-0 border-b border-r border-border bg-muted/10 last:border-r-0 md:min-h-[148px] xl:min-h-[176px]"
        />
      );
    }

    const ymd = toYmd(cell);
    const bundle = days.get(ymd);
    const isToday = sameYmd(cell, today);
    const isSelected = sameYmd(cell, selected);
    const dayColor = bundle?.dayOverride?.color;
    const { scheduleCount, pendingCount } = getCellCounts(bundle);

    return (
      <button
        key={ymd}
        type="button"
        onClick={() => onSelect(cell)}
        className={cn(
          "group relative flex min-h-[76px] min-w-0 w-full flex-col overflow-hidden border-b border-r border-border p-1 text-left transition-colors last:border-r-0 md:min-h-[148px] md:p-2.5 xl:min-h-[176px] xl:p-3",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          isSelected && "bg-accent/10 ring-1 ring-inset ring-accent/40",
        )}
      >
        {/* 상단 색상 바 (관리자 오버라이드) */}
        {dayColor ? (
          <span
            className="absolute inset-x-0 top-0 h-0.5 md:h-1"
            style={{ backgroundColor: dayColor }}
            aria-hidden
          />
        ) : null}

        {/* 날짜 번호 (좌상단) */}
        <span
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums md:size-7 md:text-base",
            isToday && "bg-accent text-accent-foreground",
            isSelected && !isToday && "text-accent",
            !isToday && !isSelected && "text-foreground/70",
          )}
        >
          {cell.getDate()}
        </span>

        {/* NEW 미확인 신청 배지 (우상단 절대 위치) */}
        {pendingCount > 0 ? (
          <span
            className="absolute right-1 top-1 flex min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 py-px text-[7px] font-bold leading-tight text-white md:right-2 md:top-2 md:min-w-[20px] md:px-1.5 md:text-[11px]"
            aria-label={`미확인 신청 ${pendingCount}건`}
          >
            {pendingCount}
          </span>
        ) : null}

        {/* 스케줄 카운트 배지 (셀 중앙) */}
        <div className="flex flex-1 items-center justify-center">
          {scheduleCount > 0 ? (
            <span className="inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-accent bg-accent/15 md:rounded-md md:px-2 md:py-1 md:text-sm">
              스케줄 {scheduleCount}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div
      className={cn(
        "w-full max-w-full overflow-hidden rounded-lg border border-border bg-card md:rounded-xl",
        className,
      )}
    >
      <div className="grid w-full grid-cols-7 border-b border-border bg-muted/30 text-center text-[9px] font-medium text-muted-foreground md:text-sm">
        {weekdays.map((w, idx) => (
          <div
            key={w}
            className={cn(
              "min-w-0 border-r border-border py-1.5 last:border-r-0 md:px-1 md:py-2.5",
              idx === 0 && "text-red-600",
              idx === 6 && "text-blue-600",
            )}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid w-full grid-cols-7">{cells.map(renderCell)}</div>

      <div className="flex items-center gap-3 border-t border-border px-3 py-2 md:gap-4 md:px-4 md:py-2.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground md:text-sm">
          <span className="inline-block rounded px-1 py-0.5 text-[8px] font-medium text-accent bg-accent/15 md:text-xs">
            스케줄 N
          </span>
          스케줄 수
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground md:text-sm">
          <span className="inline-flex min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white md:min-w-[18px] md:text-[11px]">
            N
          </span>
          미확인 신청
        </span>
      </div>
    </div>
  );
}

export { toYmd };
