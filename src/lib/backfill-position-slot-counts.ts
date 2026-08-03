import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { db } from "@/lib/firebase";
import { countApprovedForPositionSlot } from "@/lib/firestore-applications";
import { EVENTS_COLLECTION } from "@/lib/firestore-events";
import { positionSlotKey, type EventItem, type Session } from "@/types/schedule";

/**
 * 정원 공유 버그 수정(세션별 positionSlotCounts 도입) 이전에 이미 승인된 신청들은
 * 세션 카운트가 비어 있다. applications 컬렉션(ground truth)을 다시 세어
 * 모든 이벤트의 모든 세션에 positionSlotCounts를 채워 넣는 1회성 관리자 작업.
 *
 * - 여러 번 실행해도 안전함(멱등) — 매번 실카운트로 덮어쓴다.
 * - Option B(포지션 슬롯)를 쓰는 이벤트만 대상으로 한다.
 */
export async function backfillPositionSlotCounts(): Promise<{
  eventsScanned: number;
  eventsUpdated: number;
  sessionsUpdated: number;
}> {
  await assertAdmin();

  const snap = await getDocs(collection(db, EVENTS_COLLECTION));
  let eventsScanned = 0;
  let eventsUpdated = 0;
  let sessionsUpdated = 0;

  for (const eventDoc of snap.docs) {
    const event = eventDoc.data() as EventItem;
    if (!event.usePositions || !event.positions?.length) continue;
    if (!Array.isArray(event.sessions) || event.sessions.length === 0) continue;
    eventsScanned++;

    let changed = false;
    const nextSessions: Session[] = [];
    for (const session of event.sessions) {
      const counts: Record<string, number> = {};
      for (const pos of event.positions) {
        for (const slot of pos.slots) {
          const key = positionSlotKey(pos.id, slot.id);
          counts[key] = await countApprovedForPositionSlot(
            eventDoc.id,
            session.id,
            pos.id,
            slot.id,
          );
        }
      }
      const prev = session.positionSlotCounts ?? {};
      const same =
        Object.keys(counts).length === Object.keys(prev).length &&
        Object.entries(counts).every(([k, v]) => prev[k] === v);
      if (!same) {
        changed = true;
        sessionsUpdated++;
      }
      nextSessions.push({ ...session, positionSlotCounts: counts });
    }

    if (changed) {
      await updateDoc(doc(db, EVENTS_COLLECTION, eventDoc.id), {
        sessions: nextSessions,
        updatedAt: serverTimestamp(),
      });
      eventsUpdated++;
    }
  }

  return { eventsScanned, eventsUpdated, sessionsUpdated };
}
