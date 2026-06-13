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

/** 모바일 좁은 칸용 짧은 요약 (2~3줄) */
function compactMobilePreview(bundle: SheetDayBundle | undefined): string[] {
  if (!bundle?.rows.length) {
    if (bundle?.dayOverride?.manualText?.trim()) {
      return [bundle.dayOverride.manualText.trim()];
    }
    return [];
  }

  const lines: string[] = [];
  if (bundle.dayOverride?.manualText?.trim()) {
    lines.push(bundle.dayOverride.manualText.trim());
  }

  const titles = [
    ...new Set(bundle.rows.map((r) => r.eventTitle.trim()).filter(Boolean)),
  ];
  if (titles.length > 0) {
    lines.push(titles.slice(0, 2).join("·"));
  }

  const first = bundle.rows[0];
  const names = first.applicants
    .filter((a) => a.status === "approved" || a.status === "completed")
    .map((a) => a.name)
    .slice(0, 2)
    .join("/");
  if (names) {
    lines.push(names);
  } else {
    lines.push(`${first.slotTime}·${first.headcount}명`);
  }

  if (bundle.rows.length > 1) {
    lines.push(`+${bundle.rows.length - 1}건`);
  }

  return lines.slice(0, 3);
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
          className="min-h-[76px] min-w-0 border-b border-r border-border bg-muted/10 last:border-r-0 md:min-h-[128px]"
        />
      );
    }

    const ymd = toYmd(cell);
    const bundle = days.get(ymd);
    const isToday = sameYmd(cell, today);
    const isSelected = sameYmd(cell, selected);
    const hasRows = (bundle?.rows.length ?? 0) > 0;
    const dayColor = bundle?.dayOverride?.color;
    const desktopLines = (bundle?.cellPreviewLines ?? []).slice(0, 4);
    const mobileLines = compactMobilePreview(bundle);

    return (
      <button
        key={ymd}
        type="button"
        onClick={() => onSelect(cell)}
        className={cn(
          "group relative flex min-h-[76px] min-w-0 w-full flex-col overflow-hidden border-b border-r border-border p-0.5 text-left transition-colors last:border-r-0 md:min-h-[128px] md:p-2",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          isSelected && "bg-accent/10 ring-1 ring-inset ring-accent/40",
          !hasRows && !mobileLines.length && "text-muted-foreground",
        )}
      >
        {dayColor ? (
          <span
            className="absolute inset-x-0 top-0 h-0.5 md:h-1"
            style={{ backgroundColor: dayColor }}
            aria-hidden
          />
        ) : null}

        <div className="flex min-w-0 items-center justify-between gap-0.5">
          <span
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums md:size-6 md:text-sm",
              isToday && "bg-accent text-accent-foreground",
              isSelected && !isToday && "text-accent",
            )}
          >
            {cell.getDate()}
          </span>
          {bundle?.markerColors?.length ? (
            <span className="hidden shrink-0 gap-0.5 md:flex">
              {bundle.markerColors.slice(0, 3).map((c, idx) => (
                <span
                  key={`${ymd}-c-${idx}`}
                  className="size-2 rounded-full ring-1 ring-background/80"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          ) : null}
          {hasRows ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-accent md:hidden"
              aria-hidden
            />
          ) : null}
        </div>

        {/* 모바일: 화면 너비에 맞춘 짧은 요약 */}
        <div className="mt-0.5 min-w-0 flex-1 space-y-px overflow-hidden md:hidden">
          {mobileLines.map((line, idx) => (
            <p
              key={`${ymd}-m-${idx}`}
              className={cn(
                "truncate text-[7px] leading-[1.15] text-foreground/90",
                line.startsWith("+") && "text-accent",
              )}
              title={line}
            >
              {line}
            </p>
          ))}
        </div>

        {/* 데스크톱: 상세 미리보기 */}
        <div className="mt-1 hidden min-w-0 flex-1 space-y-0.5 overflow-hidden md:block">
          {desktopLines.map((line, idx) => (
            <p
              key={`${ymd}-d-${idx}`}
              className={cn(
                "truncate text-[10px] leading-tight text-foreground/90",
                line.startsWith("+") && "text-accent",
              )}
              title={line}
            >
              {line}
            </p>
          ))}
        </div>
      </button>
    );
  };

  return (
    <div
      className={cn(
        "w-full max-w-full overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="grid w-full grid-cols-7 border-b border-border bg-muted/30 text-center text-[9px] font-medium text-muted-foreground md:text-xs">
        {weekdays.map((w, idx) => (
          <div
            key={w}
            className={cn(
              "min-w-0 border-r border-border py-1.5 last:border-r-0 md:px-1 md:py-2",
              idx === 0 && "text-red-400",
              idx === 6 && "text-blue-400",
            )}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid w-full grid-cols-7">{cells.map(renderCell)}</div>

      <p className="hidden border-t border-border px-3 py-2 text-xs text-muted-foreground md:block">
        · 표시: 이벤트명 · 장소 · 승인자 · 시간/인원 · 색상 점
      </p>
      <p className="border-t border-border px-2 py-1.5 text-[10px] text-muted-foreground md:hidden">
        날짜를 탭하면 아래에서 상세 일정을 확인할 수 있습니다.
      </p>
    </div>
  );
}

export { toYmd };
