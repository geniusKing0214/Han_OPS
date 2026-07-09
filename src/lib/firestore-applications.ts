import {
  type FirestoreError,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { todayYmd } from "@/lib/application-cancel";
import { db } from "@/lib/firebase";
import { userCanApplyToEvent } from "@/lib/team-utils";
import {
  notifyAdminsOnApplicationSubmitted,
  notifyAdminsOnApplicationCancelled,
} from "@/lib/firestore-notifications";
import type { ApplicationItem, ApplicationStatus } from "@/types/application";
import type { WorkStatus } from "@/types/points";
import type { EventItem } from "@/types/schedule";
import { EVENTS_COLLECTION } from "@/lib/firestore-events";
import { USERS_COLLECTION } from "@/lib/firestore-users";
import { normalizeTeamId, type TeamId } from "@/types/team";
import type { UserProfileDoc } from "@/types/user";

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

function normalizeWorkStatus(value: unknown): WorkStatus {
  if (
    value === "completed" ||
    value === "no_show" ||
    value === "late_cancel" ||
    value === "not_checked"
  ) {
    return value;
  }
  return "not_checked";
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
    applicantDisplayName:
      typeof data.applicantDisplayName === "string"
        ? data.applicantDisplayName
        : undefined,
    applicantEmail:
      typeof data.applicantEmail === "string" ? data.applicantEmail : undefined,
    eventId: typeof data.eventId === "string" ? data.eventId : undefined,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    slotId: typeof data.slotId === "string" ? data.slotId : undefined,
    team_id: normalizeTeamId(data.team_id),
    eventTitle: typeof data.eventTitle === "string" ? data.eventTitle : "",
    venue: typeof data.venue === "string" ? data.venue : "",
    date: typeof data.date === "string" ? data.date : "",
    slotTime: typeof data.slotTime === "string" ? data.slotTime : "",
    status: normalizeStatus(data.status),
    submittedAt: timestampToIso(data.createdAt),
    note: typeof data.note === "string" ? data.note : undefined,
    rejectionReason:
      typeof data.rejectionReason === "string" ? data.rejectionReason : undefined,
    adminMemo: typeof data.adminMemo === "string" ? data.adminMemo : undefined,
    workStatus: normalizeWorkStatus(data.work_status),
    pointsAwarded: Boolean(data.points_awarded),
    completedAt: data.completed_at
      ? timestampToIso(data.completed_at)
      : undefined,
    completedByAdmin:
      typeof data.completed_by_admin === "string"
        ? data.completed_by_admin
        : undefined,
  };
}

export type CreateApplicationInput = {
  userId: string;
  applicantDisplayName: string;
  applicantEmail: string;
  eventId: string;
  sessionId: string;
  slotId: string;
  eventTitle: string;
  venue: string;
  date: string;
  slotTime: string;
  note: string;
};

export async function createApplication(input: CreateApplicationInput) {
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, input.userId));
  if (!userSnap.exists()) {
    throw new Error("사용자 정보를 찾을 수 없습니다.");
  }
  const userData = userSnap.data() as UserProfileDoc;
  const userTeamId = normalizeTeamId(userData.team_id);

  const eventSnap = await getDoc(doc(db, EVENTS_COLLECTION, input.eventId));
  if (!eventSnap.exists()) {
    throw new Error("일정을 찾을 수 없습니다.");
  }
  const eventData = eventSnap.data() as Record<string, unknown>;
  const eventForCheck: EventItem = {
    id: input.eventId,
    title: typeof eventData.title === "string" ? eventData.title : "",
    venue: typeof eventData.venue === "string" ? eventData.venue : "",
    team_ids: Array.isArray(eventData.team_ids)
      ? (eventData.team_ids as EventItem["team_ids"])
      : undefined,
    sessions: Array.isArray(eventData.sessions)
      ? (eventData.sessions as EventItem["sessions"])
      : [],
  };
  if (!userCanApplyToEvent(userTeamId, eventForCheck)) {
    throw new Error("소속 팀 일정만 신청할 수 있습니다.");
  }

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

  const appRef = await addDoc(collection(db, APPLICATIONS_COLLECTION), {
    userId: input.userId,
    applicantDisplayName: input.applicantDisplayName.trim(),
    applicantEmail: input.applicantEmail.trim(),
    eventId: input.eventId,
    sessionId: input.sessionId,
    slotId: input.slotId,
    team_id: userTeamId,
    eventTitle: input.eventTitle,
    venue: input.venue,
    date: input.date,
    slotTime: input.slotTime,
    note: input.note,
    status: "pending" as const,
    work_status: "not_checked",
    points_awarded: false,
    createdAt: serverTimestamp(),
  });

  try {
    await notifyAdminsOnApplicationSubmitted({
      applicationId: appRef.id,
      createdByUserId: input.userId,
      applicantName: input.applicantDisplayName.trim(),
      applicantEmail: input.applicantEmail.trim(),
      eventId: input.eventId,
      eventTitle: input.eventTitle,
      eventDate: input.date,
      slotTime: input.slotTime,
      location: input.venue,
    });
  } catch {
    // 신청은 성공 — 알림만 실패할 수 있음 (config/admins 미설정 등)
  }
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

function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(last).padStart(2, "0")}`;
}

/** 관리자: 전체 신청 구독 (누적 랭킹용) */
export function subscribeAllApplicationsForAdmin(
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      innerUnsub = onSnapshot(
        collection(db, APPLICATIONS_COLLECTION),
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
    })
    .catch((e) => {
      if (cancelled) return;
      onError?.({
        name: "permission-denied",
        message:
          e instanceof Error ? e.message : "관리자 권한이 필요합니다.",
      } as FirestoreError);
    });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

/** 관리자: 월간 신청 전체 구독 (date 필드 범위) */
export function subscribeApplicationsInMonthForAdmin(
  monthKey: string,
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;
  const start = `${monthKey}-01`;
  const end = lastDayOfMonth(monthKey);

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      const q = query(
        collection(db, APPLICATIONS_COLLECTION),
        where("date", ">=", start),
        where("date", "<=", end),
      );
      innerUnsub = onSnapshot(
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
    })
    .catch((e) => {
      if (cancelled) return;
      onError?.({
        name: "permission-denied",
        message:
          e instanceof Error ? e.message : "관리자 권한이 필요합니다.",
      } as FirestoreError);
    });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

/** 팀원: 본인 팀의 승인·완료 신청 월간 구독 (취합표 조회용) */
export function subscribeApplicationsInMonthForTeam(
  teamId: TeamId,
  monthKey: string,
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const start = `${monthKey}-01`;
  const end = lastDayOfMonth(monthKey);
  const q = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("team_id", "==", teamId),
    where("date", ">=", start),
    where("date", "<=", end),
    where("status", "in", ["approved", "completed"]),
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

/** 관리자: 특정 날짜(YYYY-MM-DD) 신청 전체 구독 */
export function subscribeApplicationsByDateForAdmin(
  date: string,
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      const q = query(
        collection(db, APPLICATIONS_COLLECTION),
        where("date", "==", date),
      );
      innerUnsub = onSnapshot(
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
    })
    .catch((e) => {
      if (cancelled) return;
      onError?.({
        name: "permission-denied",
        message:
          e instanceof Error ? e.message : "관리자 권한이 필요합니다.",
      } as FirestoreError);
    });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

/** 관리자: 대기 중 신청만 구독 */
export function subscribePendingApplicationsForAdmin(
  onData: (items: ApplicationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      const q = query(
        collection(db, APPLICATIONS_COLLECTION),
        where("status", "==", "pending"),
      );
      innerUnsub = onSnapshot(
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
    })
    .catch((e) => {
      if (cancelled) return;
      onError?.({
        name: "permission-denied",
        message:
          e instanceof Error ? e.message : "관리자 권한이 필요합니다.",
      } as FirestoreError);
    });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

export async function updateApplicationStatus(
  applicationId: string,
  status: Exclude<ApplicationStatus, "pending">,
) {
  await assertAdmin();
  const ref = doc(db, APPLICATIONS_COLLECTION, applicationId);
  await updateDoc(ref, { status });
}

/** 관리자: 신청 문서에 관리자 메모 저장 */
export async function updateApplicationAdminMemo(
  applicationId: string,
  adminMemo: string,
) {
  await assertAdmin();
  const ref = doc(db, APPLICATIONS_COLLECTION, applicationId);
  await updateDoc(ref, { adminMemo: adminMemo.trim() });
}

/**
 * 관리자 의사결정 처리:
 * - approved: applications 상태 업데이트 + events 슬롯 신청 인원(+1)
 * - rejected: applications 상태만 업데이트
 */
export async function decideApplication(
  applicationId: string,
  status: "approved" | "rejected",
  options?: { rejectionReason?: string },
) {
  await assertAdmin();
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
      const rejectPatch: Record<string, unknown> = { status: nextStatus };
      const reason = options?.rejectionReason?.trim();
      if (reason) rejectPatch.rejectionReason = reason;
      tx.update(appRef, rejectPatch);
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
          return { ...slot, applied_count: nextApplied };
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

/** 본인 신청 취소: pending/rejected는 삭제, approved는 슬롯 정원 복구 후 삭제 */
export async function cancelMyApplication(applicationId: string, uid: string) {
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    throw new Error("신청을 찾을 수 없습니다.");
  }

  const appData = appSnap.data() as Record<string, unknown>;
  const userId = typeof appData.userId === "string" ? appData.userId : "";
  if (userId !== uid) {
    throw new Error("본인 신청만 취소할 수 있습니다.");
  }

  const status = normalizeStatus(appData.status);
  if (status === "completed") {
    throw new Error("완료된 신청은 취소할 수 없습니다.");
  }

  const notifyPayload = {
    applicationId,
    createdByUserId: uid,
    applicantName:
      typeof appData.applicantDisplayName === "string"
        ? appData.applicantDisplayName
        : "",
    applicantEmail:
      typeof appData.applicantEmail === "string" ? appData.applicantEmail : "",
    eventId: typeof appData.eventId === "string" ? appData.eventId : "",
    eventTitle: typeof appData.eventTitle === "string" ? appData.eventTitle : "",
    eventDate: typeof appData.date === "string" ? appData.date : "",
    slotTime: typeof appData.slotTime === "string" ? appData.slotTime : "",
    location: typeof appData.venue === "string" ? appData.venue : "",
    wasApproved: status === "approved",
  };

  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(appRef);
    if (!freshSnap.exists()) {
      throw new Error("신청을 찾을 수 없습니다.");
    }
    const freshData = freshSnap.data() as Record<string, unknown>;
    const freshUserId = typeof freshData.userId === "string" ? freshData.userId : "";
    if (freshUserId !== uid) {
      throw new Error("본인 신청만 취소할 수 있습니다.");
    }

    const freshStatus = normalizeStatus(freshData.status);
    if (freshStatus === "completed") {
      throw new Error("완료된 신청은 취소할 수 없습니다.");
    }

    if (freshStatus === "pending" || freshStatus === "rejected") {
      tx.delete(appRef);
      return;
    }

    if (freshStatus === "approved") {
      const date = typeof freshData.date === "string" ? freshData.date : "";
      if (date && date < todayYmd()) {
        throw new Error("지난 일정은 취소할 수 없습니다.");
      }

      const eventId = typeof freshData.eventId === "string" ? freshData.eventId : "";
      const sessionId =
        typeof freshData.sessionId === "string" ? freshData.sessionId : "";
      const slotId = typeof freshData.slotId === "string" ? freshData.slotId : "";
      if (!eventId || !sessionId || !slotId) {
        throw new Error("신청 데이터에 event/session/slot 정보가 없습니다.");
      }

      const eventRef = doc(db, EVENTS_COLLECTION, eventId);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists()) {
        tx.delete(appRef);
        return;
      }

      const eventData = eventSnap.data() as Record<string, unknown>;
      const sessions = Array.isArray(eventData.sessions)
        ? (eventData.sessions as EventItem["sessions"])
        : [];

      const nextSessions = sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        return {
          ...sess,
          slots: sess.slots.map((slot) => {
            if (slot.id !== slotId) return slot;
            return {
              ...slot,
              applied_count: Math.max(0, slot.applied_count - 1),
            };
          }),
        };
      });

      tx.update(eventRef, {
        sessions: nextSessions,
        updatedAt: serverTimestamp(),
      });
      tx.delete(appRef);
    }
  });

  try {
    await notifyAdminsOnApplicationCancelled(notifyPayload);
  } catch {
    // 취소는 성공 — 알림만 실패할 수 있음
  }
}
