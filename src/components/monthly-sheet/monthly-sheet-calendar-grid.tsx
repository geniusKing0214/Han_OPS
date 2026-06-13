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
          className="min-h-[108px] border-b border-r border-border bg-muted/10 last:border-r-0 md:min-h-[128px]"
        />
      );
    }

    const ymd = toYmd(cell);
    const bundle = days.get(ymd);
    const isToday = sameYmd(cell, today);
    const isSelected = sameYmd(cell, selected);
    const hasRows = (bundle?.rows.length ?? 0) > 0;
    const dayColor = bundle?.dayOverride?.color;
    const previewLines = (bundle?.cellPreviewLines ?? []).slice(0, 5);

    return (
      <button
        key={ymd}
        type="button"
        onClick={() => onSelect(cell)}
        className={cn(
          "group relative flex min-h-[108px] flex-col border-b border-r border-border p-1 text-left transition-colors last:border-r-0 md:min-h-[128px] md:p-2",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          isSelected && "bg-accent/10 ring-1 ring-inset ring-accent/40",
          !hasRows && "text-muted-foreground",
        )}
      >
        {dayColor ? (
          <span
            className="absolute inset-x-0 top-0 h-0.5 md:h-1"
            style={{ backgroundColor: dayColor }}
            aria-hidden
          />
        ) : null}

        <div className="flex items-start justify-between gap-0.5">
          <span
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums md:size-6 md:text-sm",
              isToday && "bg-accent text-accent-foreground",
              isSelected && !isToday && "text-accent",
            )}
          >
            {cell.getDate()}
          </span>
          {bundle?.markerColors?.length ? (
            <span className="flex shrink-0 gap-0.5">
              {bundle.markerColors.slice(0, 2).map((c, idx) => (
                <span
                  key={`${ymd}-c-${idx}`}
                  className="size-1.5 rounded-full ring-1 ring-background/80 md:size-2"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 min-h-0 flex-1 space-y-px overflow-hidden md:mt-1 md:space-y-0.5">
          {previewLines.length > 0 ? (
            previewLines.map((line, idx) => (
              <p
                key={`${ymd}-line-${idx}`}
                className={cn(
                  "leading-[1.15] text-foreground/90",
                  "line-clamp-2 text-[8px] md:line-clamp-none md:truncate md:text-[10px]",
                  line.startsWith("+") && "text-accent",
                )}
                title={line}
              >
                {line}
              </p>
            ))
          ) : hasRows ? (
            <p className="text-[8px] text-muted-foreground md:text-[10px]">
              {bundle?.rows.length}건
            </p>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      {/* 모바일: 가로 스크롤로 칸 너비 확보 → PC처럼 텍스트 가독성 */}
      <div className="overflow-x-auto md:overflow-visible">
        <div className="min-w-[620px] md:min-w-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[10px] font-medium text-muted-foreground md:text-xs">
            {weekdays.map((w, idx) => (
              <div
                key={w}
                className={cn(
                  "border-r border-border px-1 py-2 last:border-r-0",
                  idx === 0 && "text-red-400",
                  idx === 6 && "text-blue-400",
                )}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => renderCell(cell, i))}
          </div>
        </div>
      </div>

      <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground md:text-xs">
        <span className="md:hidden">← 좌우로 스크롤하면 일정 내용을 한눈에 볼 수 있습니다.</span>
        <span className="hidden md:inline">
          · 표시: 이벤트명 · 장소 · 승인자 · 시간/인원 · 색상 점
        </span>
      </p>
    </div>
  );
}

export { toYmd };
