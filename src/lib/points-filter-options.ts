import type { EventItem } from "@/types/schedule";

/** 선택 월에 세션이 있는 현재 Firestore 이벤트만 */
export function eventsInMonth(events: EventItem[], monthKey: string): EventItem[] {
  const prefix = monthKey.trim();
  if (!prefix) return [];

  const seen = new Set<string>();
  const list: EventItem[] = [];

  for (const event of events) {
    if (seen.has(event.id)) continue;
    const hasSession = event.sessions.some((s) => {
      const date = s.date?.trim() ?? "";
      return date.startsWith(prefix);
    });
    if (!hasSession) continue;
    seen.add(event.id);
    list.push(event);
  }

  return list;
}

/** 매장명 중복 제거(대소문자·공백 무시), 빈 값 제외 */
export function uniqueVenuesFromEvents(events: EventItem[]): string[] {
  const byKey = new Map<string, string>();
  for (const event of events) {
    const venue = event.venue?.trim();
    if (!venue) continue;
    const key = venue.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, venue);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "ko"));
}

export type EventFilterOption = { id: string; label: string };

/** 이벤트 ID 기준 중복 제거, 동일 제목은 매장·날짜로 구분 */
export function uniqueEventFilterOptions(events: EventItem[]): EventFilterOption[] {
  const titleCounts = new Map<string, number>();
  for (const event of events) {
    const key = event.title.trim().toLowerCase();
    if (!key) continue;
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const seenIds = new Set<string>();
  const options: EventFilterOption[] = [];

  for (const event of events) {
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);

    const title = event.title.trim() || "제목 없음";
    const duplicateTitle = (titleCounts.get(title.toLowerCase()) ?? 0) > 1;
    const firstDate = event.sessions
      .map((s) => s.date?.trim() ?? "")
      .filter(Boolean)
      .sort()[0];

    let label = title;
    if (duplicateTitle) {
      const venue = event.venue?.trim();
      const dateLabel = firstDate
        ? firstDate.slice(5).replace("-", "/")
        : "";
      label = [title, venue, dateLabel].filter(Boolean).join(" · ");
    }

    options.push({ id: event.id, label });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, "ko"));
}
