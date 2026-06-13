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

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div
        className={cn(
          "grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-medium text-muted-foreground",
        )}
      >
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
        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-[72px] border-b border-r border-border bg-muted/10 last:border-r-0 md:min-h-[120px]"
              />
            );
          }

          const ymd = toYmd(cell);
          const bundle = days.get(ymd);
          const isToday = sameYmd(cell, today);
          const isSelected = sameYmd(cell, selected);
          const hasRows = (bundle?.rows.length ?? 0) > 0;
          const dayColor = bundle?.dayOverride?.color;

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelect(cell)}
              className={cn(
                "group relative min-h-[72px] border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 md:min-h-[120px] md:p-2",
                "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                isSelected && "bg-accent/10 ring-1 ring-inset ring-accent/40",
                !hasRows && "text-muted-foreground",
              )}
            >
              {dayColor ? (
                <span
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ backgroundColor: dayColor }}
                  aria-hidden
                />
              ) : null}
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums md:text-sm",
                    isToday && "bg-accent text-accent-foreground",
                    isSelected && !isToday && "text-accent",
                  )}
                >
                  {cell.getDate()}
                </span>
                {bundle?.markerColors?.length ? (
                  <span className="hidden gap-0.5 md:flex">
                    {bundle.markerColors.slice(0, 3).map((c, idx) => (
                      <span
                        key={`${ymd}-c-${idx}`}
                        className="size-2 rounded-full ring-1 ring-background/80"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 hidden space-y-0.5 md:block">
                {(bundle?.cellPreviewLines ?? []).slice(0, 4).map((line, idx) => (
                  <p
                    key={`${ymd}-line-${idx}`}
                    className="truncate text-[10px] leading-tight text-foreground/90"
                  >
                    {line}
                  </p>
                ))}
              </div>

              {hasRows ? (
                <span className="mt-1 inline-flex rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent md:hidden">
                  {bundle?.rows.length}건
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { toYmd };
