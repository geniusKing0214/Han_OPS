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
