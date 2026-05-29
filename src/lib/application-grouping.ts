import type { ApplicationItem } from "@/types/application";

export function monthKeyFromDateYmd(dateYmd: string): string {
  if (dateYmd.length >= 7) return dateYmd.slice(0, 7);
  return "0000-00";
}

export function formatApplicationMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  return `${y}년 ${Number(m)}월`;
}

function sortApplicationsByEventDate(items: ApplicationItem[]): ApplicationItem[] {
  return [...items].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.slotTime.localeCompare(a.slotTime);
  });
}

export type ApplicationMonthGroup = {
  monthKey: string;
  label: string;
  items: ApplicationItem[];
};

/** 일정 날짜 기준 월별 그룹 (최신 월 → 과거 월, 월 내 최신 일정 우선) */
export function groupApplicationsByMonth(
  items: ApplicationItem[],
): ApplicationMonthGroup[] {
  const map = new Map<string, ApplicationItem[]>();

  for (const item of items) {
    const key = monthKeyFromDateYmd(item.date);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, groupItems]) => ({
      monthKey,
      label: formatApplicationMonthLabel(monthKey),
      items: sortApplicationsByEventDate(groupItems),
    }));
}
