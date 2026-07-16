import type { WeekdayKey } from "@/types/workforce";
import { WEEKDAY_KEYS } from "@/types/workforce";

export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 해당 날짜가 속한 주의 월요일 (로컬) */
export function getWeekStartMonday(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYmd(d);
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseYmd(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toYmd(d);
  });
}

export function shiftWeek(weekStart: string, weeks: number): string {
  const d = parseYmd(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return toYmd(d);
}

export type WorkforceRangeSpan = "1w" | "2w" | "1m";

export function getMonthDates(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return Array.from({ length: last }, (_, i) => {
    const day = `${i + 1}`.padStart(2, "0");
    return `${yearMonth}-${day}`;
  });
}

/** 커서(월요일 또는 월 시작일) + 범위 → 표시할 날짜 목록 */
export function getRangeDates(
  cursor: string,
  span: WorkforceRangeSpan,
): string[] {
  if (span === "1w") {
    return getWeekDates(getWeekStartMonday(parseYmd(cursor)));
  }
  if (span === "2w") {
    const mon = getWeekStartMonday(parseYmd(cursor));
    return [...getWeekDates(mon), ...getWeekDates(shiftWeek(mon, 1))];
  }
  return getMonthDates(yearMonthFromYmd(cursor));
}

/** 날짜들에 걸친 주(월요일) 목록 */
export function getWeekStartsCoveringDates(dates: string[]): string[] {
  const set = new Set<string>();
  for (const d of dates) {
    if (!d) continue;
    set.add(getWeekStartMonday(parseYmd(d)));
  }
  return [...set].sort();
}

export function shiftRangeCursor(
  cursor: string,
  span: WorkforceRangeSpan,
  dir: -1 | 1,
): string {
  if (span === "1w") {
    return shiftWeek(getWeekStartMonday(parseYmd(cursor)), dir);
  }
  if (span === "2w") {
    return shiftWeek(getWeekStartMonday(parseYmd(cursor)), dir * 2);
  }
  const d = parseYmd(`${yearMonthFromYmd(cursor)}-01`);
  d.setMonth(d.getMonth() + dir);
  return toYmd(d);
}

export function normalizeRangeCursor(
  cursor: string,
  span: WorkforceRangeSpan,
): string {
  if (span === "1m") {
    return `${yearMonthFromYmd(cursor)}-01`;
  }
  return getWeekStartMonday(parseYmd(cursor));
}

export function formatRangeLabel(
  cursor: string,
  span: WorkforceRangeSpan,
): string {
  const dates = getRangeDates(cursor, span);
  if (dates.length === 0) return "";
  const start = parseYmd(dates[0]!);
  const end = parseYmd(dates[dates.length - 1]!);
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${`${d.getMonth() + 1}`.padStart(2, "0")}.${`${d.getDate()}`.padStart(2, "0")}`;
  if (span === "1m") {
    return `${start.getFullYear()}.${`${start.getMonth() + 1}`.padStart(2, "0")}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

/** 달력 그리드용: 월요일 시작 주 단위로 패딩된 셀 (빈칸은 null) */
export function buildCalendarWeeks(dates: string[]): (string | null)[][] {
  if (dates.length === 0) return [];
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const startMon = getWeekStartMonday(parseYmd(first));
  const endSun = (() => {
    const mon = getWeekStartMonday(parseYmd(last));
    return getWeekDates(mon)[6]!;
  })();
  const dateSet = new Set(dates);
  const cells: (string | null)[] = [];
  let cur = startMon;
  while (cur <= endSun) {
    cells.push(dateSet.has(cur) ? cur : null);
    const d = parseYmd(cur);
    d.setDate(d.getDate() + 1);
    cur = toYmd(d);
  }
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function weekdayKeyFromYmd(ymd: string): WeekdayKey {
  const day = parseYmd(ymd).getDay(); // 0=Sun
  const map: WeekdayKey[] = [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ];
  return map[day] ?? "mon";
}

export function weekdayIndexFromYmd(ymd: string): number {
  return WEEKDAY_KEYS.indexOf(weekdayKeyFromYmd(ymd));
}

export function formatWeekRangeLabel(weekStart: string): string {
  const dates = getWeekDates(weekStart);
  const start = parseYmd(dates[0]!);
  const end = parseYmd(dates[6]!);
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${`${d.getMonth() + 1}`.padStart(2, "0")}.${`${d.getDate()}`.padStart(2, "0")}`;
  const dow = ["일", "월", "화", "수", "목", "금", "토"];
  return `${fmt(start)} (${dow[start.getDay()]}) – ${fmt(end)} (${dow[end.getDay()]})`;
}

export function formatDayHeader(ymd: string): { label: string; dow: string } {
  const d = parseYmd(ymd);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] ?? "";
  return {
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    dow,
  };
}

export function yearMonthFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}
