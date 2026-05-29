import type { EventItem } from "@/types/schedule";

/** 슬롯에 신청 가능한 잔여 정원이 있는지 */
export function isSlotOpen(slot: { applied_count: number; capacity: number }): boolean {
  return slot.applied_count < slot.capacity;
}

/**
 * 대시보드·통계용: 사용자가 아직 신청하지 않았고,
 * 오늘 이후 세션 중 정원이 남은 슬롯이 하나라도 있는 이벤트 수.
 */
export function countAvailableApplicationEvents(
  events: EventItem[],
  appliedEventIds: ReadonlySet<string>,
  fromDateYmd: string,
): number {
  let count = 0;
  for (const ev of events) {
    if (appliedEventIds.has(ev.id)) continue;
    const hasOpenSlot = ev.sessions.some(
      (session) =>
        session.date >= fromDateYmd &&
        session.slots.some((slot) => isSlotOpen(slot)),
    );
    if (hasOpenSlot) count++;
  }
  return count;
}

/** 정원이 남아 신청 가능한 슬롯 수 (이미 신청한 이벤트 제외) */
export function countAvailableApplicationSlots(
  events: EventItem[],
  appliedEventIds: ReadonlySet<string>,
  fromDateYmd: string,
): number {
  let count = 0;
  for (const ev of events) {
    if (appliedEventIds.has(ev.id)) continue;
    for (const session of ev.sessions) {
      if (session.date < fromDateYmd) continue;
      for (const slot of session.slots) {
        if (isSlotOpen(slot)) count++;
      }
    }
  }
  return count;
}
