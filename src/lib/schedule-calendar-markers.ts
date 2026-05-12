import type { ApplicationItem } from "@/types/application";
import type { EventItem } from "@/types/schedule";

/** 이벤트에 색이 없을 때 달력 점은 테마 강조색으로 표시 */
export const DEFAULT_MARKER = "";

function normalizeColor(raw: string | undefined): string {
  const c = raw?.trim() ?? "";
  if (!c) return DEFAULT_MARKER;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(c)) return c;
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c}`;
  return c;
}

/** 세션이 있는 날짜마다, 그날 열리는 이벤트들의 색(중복 제거) */
export function buildSessionDateMarkers(events: EventItem[]): Map<string, string[]> {
  const byDate = new Map<string, Set<string>>();
  for (const ev of events) {
    const color = normalizeColor(ev.color);
    for (const sess of ev.sessions) {
      if (!sess.date) continue;
      let set = byDate.get(sess.date);
      if (!set) {
        set = new Set();
        byDate.set(sess.date, set);
      }
      set.add(color);
    }
  }
  return new Map(
    [...byDate.entries()].map(([d, set]) => [d, [...set]] as const),
  );
}

/** 신청이 있는 날짜마다 해당 이벤트 색(중복 제거) */
export function buildApplicationDateMarkers(
  items: ApplicationItem[],
  events: EventItem[],
): Map<string, string[]> {
  const eventColor = new Map<string, string>();
  for (const ev of events) {
    eventColor.set(ev.id, normalizeColor(ev.color));
  }
  const byDate = new Map<string, Set<string>>();
  for (const a of items) {
    if (!a.date) continue;
    const c = a.eventId ? (eventColor.get(a.eventId) ?? DEFAULT_MARKER) : DEFAULT_MARKER;
    let set = byDate.get(a.date);
    if (!set) {
      set = new Set();
      byDate.set(a.date, set);
    }
    set.add(c);
  }
  return new Map(
    [...byDate.entries()].map(([d, set]) => [d, [...set]] as const),
  );
}
