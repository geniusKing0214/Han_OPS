import type { ApplicationItem } from "@/types/application";
import type { PointLogDoc } from "@/types/points";
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
    if (!eid || !sid) return false;

    const ev = byEventId.get(eid);
    if (!ev) return false;

    const session = ev.sessions.find((s) => s.id === sid);
    if (!session) return false;

    if (session.date !== a.date) return false;

    // 포지션 기반 이벤트: slots가 없고 usePositions=true이면
    // positionSlotId로 검증 (포지션이 존재하면 통과)
    if (ev.usePositions && session.slots.length === 0) {
      if (a.positionSlotId) {
        // positionSlotId가 실제 포지션의 슬롯 중 하나인지 확인
        const slotExists = (ev.positions ?? []).some((p) =>
          p.slots?.some((s) => s.id === a.positionSlotId),
        );
        return slotExists;
      }
      // positionSlotId 없이 sessionId만 있는 구형 신청도 허용
      return true;
    }

    // 일반 슬롯 기반 이벤트
    const lid = a.slotId;
    if (!lid) return false;
    const slot = session.slots.find((s) => s.id === lid);
    if (!slot) return false;
    if (slot.start_time.trim() !== a.slotTime.trim()) return false;

    return true;
  });
}

/** 삭제·변경된 일정에 묶인 포인트 로그 제외 (관리자 수동 조정은 유지) */
export function filterPointLogsMatchingLiveApplications(
  logs: PointLogDoc[],
  liveApplications: ApplicationItem[],
): PointLogDoc[] {
  const liveAppIds = new Set(liveApplications.map((a) => a.id));
  return logs.filter(
    (l) =>
      (l.point_type === "adjustment" && !l.application_id?.trim()) ||
      liveAppIds.has(l.application_id),
  );
}
