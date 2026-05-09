import {
  type FirestoreError,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { ApplicationItem, ApplicationStatus } from "@/types/application";
import type { EventItem } from "@/types/schedule";
import { EVENTS_COLLECTION } from "@/lib/firestore-events";

export const APPLICATIONS_COLLECTION = "applications";

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function normalizeStatus(value: unknown): ApplicationStatus {
  if (
    value === "approved" ||
    value === "rejected" ||
    value === "completed" ||
    value === "pending"
  ) {
    return value;
  }
  return "pending";
}

function docToApplicationItem(
  id: string,
  data: Record<string, unknown>,
): ApplicationItem {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    eventId: typeof data.eventId === "string" ? data.eventId : undefined,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    slotId: typeof data.slotId === "string" ? data.slotId : undefined,
    eventTitle: typeof data.eventTitle === "string" ? data.eventTitle : "",
    venue: typeof data.venue === "string" ? data.venue : "",
    date: typeof data.date === "string" ? data.date : "",
    slotTime: typeof data.slotTime === "string" ? data.slotTime : "",
    status: normalizeStatus(data.status),
    submittedAt: timestampToIso(data.createdAt),
    note: typeof data.note === "string" ? data.note : undefined,
  };
}

export type CreateApplicationInput = {
  userId: string;
  eventId: string;
  sessionId: string;
  slotId: string;
  eventTitle: string;
  venue: string;
  date: string;
  slotTime: string;
  note: string;
};

async function pruneMyApplicationsToFive(uid: string) {
  const q = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("userId", "==", uid),
  );
  const snap = await getDocs(q);
  const docs = [...snap.docs].sort((a, b) => {
    const aIso = timestampToIso((a.data() as Record<string, unknown>).createdAt);
    const bIso = timestampToIso((b.data() as Record<string, unknown>).createdAt);
    return bIso.localeCompare(aIso);
  });
  const overflow = docs.slice(5);
  await Promise.all(overflow.map((d) => deleteDoc(d.ref)));
}

export async function createApplication(input: CreateApplicationInput) {
  const dupQuery = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("userId", "==", input.userId),
    where("eventId", "==", input.eventId),
  );
  const dupSnap = await getDocs(dupQuery);
  const hasActive = dupSnap.docs.some((d) => {
    const data = d.data() as Record<string, unknown>;
    const s = normalizeStatus(data.status);
    return s === "pending" || s === "approved" || s === "completed";
  });
  if (hasActive) {
    throw new Error("같은 이벤트에는 중복 신청할 수 없습니다.");
  }

  await addDoc(collection(db, APPLICATIONS_COLLECTION), {
    userId: input.userId,
    eventId: input.eventId,
    sessionId: input.sessionId,
    slotId: input.slotId,
    eventTitle: input.eventTitle,
    venue: input.venue,
    date: input.date,
    slotTime: input.slotTime,
    note: input.note,
    status: "pending" as const,
    createdAt: serverTimestamp(),
  });

  // 사용자별 신청 내역은 최신 5개만 유지
  await pruneMyApplicationsToFive(input.userId);
}

export function subscribeMyApplications(
  uid: string,
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("userId", "==", uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) =>
          docToApplicationItem(d.id, d.data() as Record<string, unknown>),
        )
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      onData(items);
    },
    (err) => onError?.(err),
  );
}

/** 관리자: 대기 중 신청만 구독 */
export function subscribePendingApplicationsForAdmin(
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) =>
          docToApplicationItem(d.id, d.data() as Record<string, unknown>),
        )
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      onData(items);
    },
    (err) => onError?.(err),
  );
}

export async function updateApplicationStatus(
  applicationId: string,
  status: Exclude<ApplicationStatus, "pending">,
) {
  const ref = doc(db, APPLICATIONS_COLLECTION, applicationId);
  await updateDoc(ref, { status });
}

/**
 * 관리자 의사결정 처리:
 * - approved: applications 상태 업데이트 + events 슬롯 신청 인원(+1)
 * - rejected: applications 상태만 업데이트
 */
export async function decideApplication(
  applicationId: string,
  status: "approved" | "rejected",
) {
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);

  await runTransaction(db, async (tx) => {
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("신청 문서를 찾을 수 없습니다.");
    }
    const appData = appSnap.data() as Record<string, unknown>;
    const currentStatus = normalizeStatus(appData.status);
    if (currentStatus !== "pending") {
      throw new Error("이미 처리된 신청입니다.");
    }

    const nextStatus: Exclude<ApplicationStatus, "pending"> = status;

    if (status !== "approved") {
      tx.update(appRef, { status: nextStatus });
      return;
    }

    const eventId = typeof appData.eventId === "string" ? appData.eventId : "";
    const sessionId =
      typeof appData.sessionId === "string" ? appData.sessionId : "";
    const slotId = typeof appData.slotId === "string" ? appData.slotId : "";
    if (!eventId || !sessionId || !slotId) {
      throw new Error("신청 데이터에 event/session/slot 정보가 없습니다.");
    }

    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("대상 이벤트를 찾을 수 없습니다.");
    }

    const eventData = eventSnap.data() as Record<string, unknown>;
    const sessions = Array.isArray(eventData.sessions)
      ? (eventData.sessions as EventItem["sessions"])
      : [];
    let sessionFound = false;
    let slotFound = false;
    const nextSessions = sessions.map((sess) => {
      if (sess.id !== sessionId) return sess;
      sessionFound = true;
      return {
        ...sess,
        slots: sess.slots.map((slot) => {
          if (slot.id !== slotId) return slot;
          slotFound = true;
          if (slot.applied_count >= slot.capacity) {
            throw new Error("슬롯이 이미 마감되어 승인할 수 없습니다.");
          }
          const nextApplied = slot.applied_count + 1;
          // 승인되면 해당 슬롯은 즉시 마감 처리
          return { ...slot, applied_count: nextApplied, capacity: nextApplied };
        }),
      };
    });
    if (!sessionFound || !slotFound) {
      throw new Error("이벤트의 세션/슬롯을 찾을 수 없습니다.");
    }

    // 트랜잭션 규칙: 모든 read(tx.get) 후에 write(tx.update) 실행
    tx.update(eventRef, {
      sessions: nextSessions,
      updatedAt: serverTimestamp(),
    });
    tx.update(appRef, { status: nextStatus });
  });
}
