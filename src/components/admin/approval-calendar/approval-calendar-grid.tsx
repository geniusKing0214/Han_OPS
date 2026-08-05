"use client";

import { cn } from "@/lib/utils";
import type { ApprovalCalendarDay } from "@/lib/approval-calendar-aggregator";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function todayYmd(): string {
  const now = new Date();
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 이름을 5개씩 끊어 1행5열이 넘어가면 다음 행으로 이어지게 한다 */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** 달력 셀에 들어갈 (주, 요일) 단위의 날짜 그리드 — 앞뒤 빈 칸은 null */
export function buildCalendarWeeks(month: Date): (string | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toYmd(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function EventBlock({ entry }: { entry: ApprovalCalendarDay["entries"][number] }) {
  return (
    <div className="space-y-1">
      <p
        className="text-center text-[12px] font-bold leading-snug"
        style={entry.eventColor ? { color: entry.eventColor } : undefined}
      >
        {entry.eventTitle}
      </p>
      <div className="space-y-0.5">
        {entry.timeGroups.map((tg) => (
          <div key={tg.time} className="space-y-0.5">
            {chunk(tg.names, 5).map((row, ri) => (
              <div
                key={ri}
                className="flex flex-nowrap items-baseline justify-center gap-x-1.5"
              >
                {ri === 0 ? (
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-foreground">
                    {tg.time}
                  </span>
                ) : null}
                {row.map((name, ni) => (
                  <span
                    key={`${name}-${ni}`}
                    className="shrink-0 whitespace-nowrap text-[11px] font-medium text-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApprovalCalendarGrid({
  month,
  days,
}: {
  month: Date;
  days: Map<string, ApprovalCalendarDay>;
}) {
  const weeks = buildCalendarWeeks(month);
  const today = todayYmd();

  return (
    <div
      id="approval-calendar-grid"
      className="overflow-x-auto rounded-xl border border-border"
    >
      <div className="min-w-[1540px]">
        <div className="grid grid-cols-7">
          {weekdays.map((w) => (
            <div
              key={w}
              className="border-b border-r border-border bg-muted/40 px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0"
            >
              {w}요일
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((ymd, di) => {
              if (!ymd) {
                return (
                  <div
                    key={di}
                    className="border-b border-r border-border bg-muted/10 last:border-r-0"
                  />
                );
              }
              const bundle = days.get(ymd);
              const dayNum = Number(ymd.slice(-2));
              const isToday = ymd === today;
              return (
                <div
                  key={ymd}
                  className={cn(
                    "flex flex-col gap-2 border-b border-r border-border p-2 last:border-r-0",
                    isToday && "bg-accent/5",
                  )}
                >
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {dayNum}
                  </span>
                  {bundle && bundle.entries.length > 0 ? (
                    <div className="space-y-2.5">
                      {bundle.entries.map((entry) => (
                        <EventBlock key={entry.eventId} entry={entry} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
