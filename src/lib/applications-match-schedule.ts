import type { ApplicationItem } from "@/types/application";
import type { EventItem } from "@/types/schedule";

/**
 * 현재 Firestore `events`에 동일 ID의 세션·슬롯이 있고,
 * 저장된 날짜·시간(start_time)과 신청 문서가 일치할 때만 통과합니다.
 * 삭제된 이벤트, 수정으로 바뀐 일정은 목록에서 제외합니다.
 */
export function filterApplicationsMatchingLiveSchedule(
  items: ApplicationItem[],
  events: EventItem[],
): ApplicationItem[] {
  const byEventId = new Map(events.map((e) => [e.id, e] as const));

  return items.filter((a) => {
    const eid = a.eventId;
    const sid = a.sessionId;
    const lid = a.slotId;
    if (!eid || !sid || !lid) return false;

    const ev = byEventId.get(eid);
    if (!ev) return false;

    const session = ev.sessions.find((s) => s.id === sid);
    if (!session) return false;

    const slot = session.slots.find((s) => s.id === lid);
    if (!slot) return false;

    if (session.date !== a.date) return false;
    if (slot.start_time.trim() !== a.slotTime.trim()) return false;

    return true;
  });
}
