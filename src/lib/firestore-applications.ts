import {
  type FirestoreError,
  addDoc,
  collection,
  deleteField,
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

import { getAuth } from "firebase/auth";

import { assertAdmin } from "@/lib/admin-access";
import { todayYmd } from "@/lib/application-cancel";
import { db } from "@/lib/firebase";
import { userCanApplyToEvent } from "@/lib/team-utils";
import { canTeamApplyNow, formatTeam2ApplyOpensAt, hasTeam2Stagger } from "@/lib/application-window";
import {
  notifyAdminsOnApplicationSubmitted,
  notifyAdminsOnApplicationCancelled,
  notifyMemberOnApplicationApproved,
} from "@/lib/firestore-notifications";
import { writeActivityLog } from "@/lib/firestore-activity-log";
import type { ApplicationItem, ApplicationStatus } from "@/types/application";
import type { WorkStatus } from "@/types/points";
import type { EventItem, Session } from "@/types/schedule";
import { positionSlotKey } from "@/types/schedule";
import { EVENTS_COLLECTION } from "@/lib/firestore-events";
import { USERS_COLLECTION } from "@/lib/firestore-users";
import {
  WORKFORCE_AVAILABILITY,
  defaultAvailability,
  docToAvailability,
} from "@/lib/firestore-workforce";
import { isUserAvailableOnDate } from "@/lib/workforce-logic";
import { getWeekStartMonday, parseYmd } from "@/lib/workforce-dates";
import { normalizeTeamId, normalizeTeamIds, type TeamId } from "@/types/team";
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

/**
 * 특정 이벤트/포지션/슬롯에 대해, 주어진 세션(sessionId)을 (직접 또는 연속 묶음으로)
 * 차지하고 있는 승인/완료 신청 수를 applications 컬렉션에서 직접 세어 반환한다.
 * session.positionSlotCounts가 아직 없는 세션(이 기능 배포 이전에 승인된 건)을
 * 처음 건드릴 때 실카운트로 시드하는 용도 — ground truth인 applications 문서 기준.
 */
export async function countApprovedForPositionSlot(
  eventId: string,
  sessionId: string,
  positionId: string,
  positionSlotId: string,
): Promise<number> {
  const q = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("eventId", "==", eventId),
    where("positionId", "==", positionId),
    where("positionSlotId", "==", positionSlotId),
  );
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const status = normalizeStatus(data.status);
    if (status !== "approved" && status !== "completed") continue;
    const docSessionId = typeof data.sessionId === "string" ? data.sessionId : "";
    const groupSessionIds = Array.isArray(data.groupSessionIds)
      ? (data.groupSessionIds as unknown[]).filter((s): s is string => typeof s === "string")
      : null;
    if (docSessionId === sessionId || (groupSessionIds?.includes(sessionId) ?? false)) {
      count++;
    }
  }
  return count;
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
    positionId:
      typeof data.positionId === "string" ? data.positionId : undefined,
    positionLabel:
      typeof data.positionLabel === "string" ? data.positionLabel : undefined,
    positionSlotId:
      typeof data.positionSlotId === "string" ? data.positionSlotId : undefined,
    positionSlotTime:
      typeof data.positionSlotTime === "string" ? data.positionSlotTime : undefined,
    groupId: typeof data.groupId === "string" ? data.groupId : undefined,
    groupDates: Array.isArray(data.groupDates)
      ? (data.groupDates as string[])
      : undefined,
    groupSessionIds: Array.isArray(data.groupSessionIds)
      ? (data.groupSessionIds as string[])
      : undefined,
    packageId: typeof data.packageId === "string" ? data.packageId : undefined,
    packageLabel: typeof data.packageLabel === "string" ? data.packageLabel : undefined,
    packageDates: Array.isArray(data.packageDates)
      ? (data.packageDates as string[])
      : undefined,
    cancelRequestedAt: data.cancelRequestedAt
      ? timestampToIso(data.cancelRequestedAt)
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
  positionId?: string;
  positionLabel?: string;
  positionSlotId?: string;
  positionSlotTime?: string;
  /** 연속 일정 묶음 */
  groupId?: string;
  groupDates?: string[];
  groupSessionIds?: string[];
  /** 기간 패키지 신청 */
  packageId?: string;
  packageLabel?: string;
  packageDates?: string[];
};

export async function createApplication(input: CreateApplicationInput) {
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, input.userId));
  if (!userSnap.exists()) {
    throw new Error("사용자 정보를 찾을 수 없습니다.");
  }
  const userData = userSnap.data() as UserProfileDoc;
  const userTeamId = normalizeTeamId(userData.team_id);
  const isAdmin = userData.role === "admin";

  // 어드민이 아닌 경우에만 팀·시간 제한 검사
  if (!isAdmin) {
    const eventSnap = await getDoc(doc(db, EVENTS_COLLECTION, input.eventId));
    if (!eventSnap.exists()) {
      throw new Error("일정을 찾을 수 없습니다.");
    }
    const eventData = eventSnap.data() as Record<string, unknown>;
    const team2Raw = eventData.team2ApplyOpensAt;
    let team2ApplyOpensAt: string | undefined;
    if (
      team2Raw &&
      typeof team2Raw === "object" &&
      "toDate" in team2Raw &&
      typeof (team2Raw as { toDate: () => Date }).toDate === "function"
    ) {
      team2ApplyOpensAt = (team2Raw as { toDate: () => Date }).toDate().toISOString();
    } else if (typeof team2Raw === "string") {
      team2ApplyOpensAt = team2Raw;
    }
    const eventForCheck: EventItem = {
      id: input.eventId,
      title: typeof eventData.title === "string" ? eventData.title : "",
      venue: typeof eventData.venue === "string" ? eventData.venue : "",
      team_ids: Array.isArray(eventData.team_ids)
        ? normalizeTeamIds(eventData.team_ids)
        : undefined,
      ...(team2ApplyOpensAt ? { team2ApplyOpensAt } : {}),
      sessions: Array.isArray(eventData.sessions)
        ? (eventData.sessions as EventItem["sessions"])
        : [],
    };
    if (!userCanApplyToEvent(userTeamId, eventForCheck)) {
      if (
        userTeamId === "team_2" &&
        hasTeam2Stagger(eventForCheck) &&
        !canTeamApplyNow(eventForCheck, "team_2")
      ) {
        const opensLabel = formatTeam2ApplyOpensAt(eventForCheck);
        throw new Error(
          opensLabel
            ? `2팀 신청은 ${opensLabel}부터 가능합니다. (1팀 등록 24시간 후)`
            : "2팀 신청은 일정 등록 24시간 후부터 가능합니다.",
        );
      }
      throw new Error("소속 팀 일정만 신청할 수 있습니다.");
    }

    const availSnap = await getDoc(
      doc(db, WORKFORCE_AVAILABILITY, input.userId),
    );
    const avail = availSnap.exists()
      ? docToAvailability(
          input.userId,
          availSnap.data() as Record<string, unknown>,
        )
      : defaultAvailability(input.userId);
    // 주간 가용성 체크 스킵 조건:
    // 1) 연속 일정 묶음(groupId) 신청
    // 2) 기간 패키지(packageId) 신청
    // 3) 어드민이 상시 신청 허용(forceApplyOpen)을 켠 이벤트 — 신청기간 무관 오픈.
    //    신청기간이 아닌데 신청을 받는 유일한 수단은 이 플래그여야 하므로,
    //    locked=false(기본값)만으로는 더 이상 스킵하지 않는다.
    const isGroupApp = !!input.groupId && Array.isArray(input.groupDates) && input.groupDates.length > 1;
    const isPackageApp = !!input.packageId;
    const isForceApplyOpen = eventData.forceApplyOpen === true;
    const skipWeeklyCheck = isGroupApp || isPackageApp || isForceApplyOpen;
    if (!skipWeeklyCheck) {
      if (!isUserAvailableOnDate(avail, input.date)) {
        throw new Error("근무 불가로 설정한 날짜에는 신청할 수 없습니다.");
      }
      const eventWeekStart = getWeekStartMonday(parseYmd(input.date));
      if (!avail.memberSubmittedWeeks.includes(eventWeekStart)) {
        throw new Error(
          "익주 근무 가능일을 먼저 제출해야 신청할 수 있습니다.",
        );
      }
    }
  }

  // 세션(날짜) 단위로 중복 체크 — 이벤트 단위로만 체크하면 같은 반복 이벤트의
  // 다른 날짜에 정상적으로 재신청하는 경우까지 막히므로 sessionId도 함께 본다.
  const dupQuery = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("userId", "==", input.userId),
    where("eventId", "==", input.eventId),
    where("sessionId", "==", input.sessionId),
  );
  const dupSnap = await getDocs(dupQuery);
  const hasActive = dupSnap.docs.some((d) => {
    const data = d.data() as Record<string, unknown>;
    const s = normalizeStatus(data.status);
    return s === "pending" || s === "approved" || s === "completed";
  });
  if (hasActive) {
    throw new Error("같은 일정에는 중복 신청할 수 없습니다.");
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
    ...(input.positionId ? { positionId: input.positionId } : {}),
    ...(input.positionLabel ? { positionLabel: input.positionLabel } : {}),
    ...(input.positionSlotId ? { positionSlotId: input.positionSlotId } : {}),
    ...(input.positionSlotTime ? { positionSlotTime: input.positionSlotTime } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    ...(input.groupDates ? { groupDates: input.groupDates } : {}),
    ...(input.groupSessionIds ? { groupSessionIds: input.groupSessionIds } : {}),
    ...(input.packageId ? { packageId: input.packageId } : {}),
    ...(input.packageLabel ? { packageLabel: input.packageLabel } : {}),
    ...(input.packageDates ? { packageDates: input.packageDates } : {}),
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

/** 관리자: 취소 승인 대기 중인 신청(승인됨 + cancelRequestedAt 있음) 구독 */
export function subscribeCancelRequestedApplicationsForAdmin(
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
        where("status", "==", "approved"),
      );
      innerUnsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((d) =>
              docToApplicationItem(d.id, d.data() as Record<string, unknown>),
            )
            .filter((a) => !!a.cancelRequestedAt)
            .sort((a, b) =>
              (b.cancelRequestedAt ?? "").localeCompare(a.cancelRequestedAt ?? ""),
            );
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
  const actorUid = await assertAdmin();
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    throw new Error("신청 문서를 찾을 수 없습니다.");
  }
  const appData = appSnap.data() as Record<string, unknown>;

  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(appRef);
    if (!freshSnap.exists()) {
      throw new Error("신청 문서를 찾을 수 없습니다.");
    }
    const freshData = freshSnap.data() as Record<string, unknown>;
    const currentStatus = normalizeStatus(freshData.status);
    if (currentStatus !== "pending") {
      throw new Error("이미 처리된 신청입니다.");
    }

    const eventId = typeof freshData.eventId === "string" ? freshData.eventId : "";
    const sessionId =
      typeof freshData.sessionId === "string" ? freshData.sessionId : "";
    const slotId = typeof freshData.slotId === "string" ? freshData.slotId : "";
    const positionId = typeof freshData.positionId === "string" ? freshData.positionId : "";
    const positionSlotId = typeof freshData.positionSlotId === "string" ? freshData.positionSlotId : "";

    const nextStatus: Exclude<ApplicationStatus, "pending"> = status;

    if (status !== "approved") {
      const rejectPatch: Record<string, unknown> = { status: nextStatus };
      const reason = options?.rejectionReason?.trim();
      if (reason) rejectPatch.rejectionReason = reason;
      tx.update(appRef, rejectPatch);
      return;
    }

    if (!eventId) {
      throw new Error("신청 데이터에 event 정보가 없습니다.");
    }

    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("대상 이벤트를 찾을 수 없습니다.");
    }

    const eventData = eventSnap.data() as Record<string, unknown>;

    // Option B: 포지션 슬롯 기반 승인 — 정원(카운트)은 세션(날짜)별로 독립 추적한다.
    // (positions[].slots[].capacity/time 등 "정의"는 이벤트 레벨 공유 템플릿 그대로 사용)
    if (positionId && positionSlotId) {
      const positions = Array.isArray(eventData.positions)
        ? (eventData.positions as Array<Record<string, unknown>>)
        : [];
      const posDef = positions.find((p) => p.id === positionId);
      const slotDef = Array.isArray(posDef?.slots)
        ? (posDef.slots as Array<Record<string, unknown>>).find((s) => s.id === positionSlotId)
        : undefined;
      if (!posDef || !slotDef) {
        throw new Error("포지션/슬롯을 찾을 수 없습니다.");
      }
      const cap = typeof slotDef.capacity === "number" ? slotDef.capacity : 0;

      const groupSessionIds = Array.isArray(freshData.groupSessionIds)
        ? (freshData.groupSessionIds as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : [];
      const targetSessionIds = groupSessionIds.length > 0 ? groupSessionIds : [sessionId];

      const sessions = Array.isArray(eventData.sessions)
        ? (eventData.sessions as Session[])
        : [];
      const key = positionSlotKey(positionId, positionSlotId);

      const currentCounts = new Map<string, number>();
      for (const sid of targetSessionIds) {
        const sess = sessions.find((s) => s.id === sid);
        if (!sess) throw new Error("이벤트의 세션을 찾을 수 없습니다.");
        const existing = sess.positionSlotCounts?.[key];
        const count =
          existing ??
          (await countApprovedForPositionSlot(eventId, sid, positionId, positionSlotId));
        currentCounts.set(sid, count);
      }
      for (const sid of targetSessionIds) {
        if (currentCounts.get(sid)! >= cap) {
          throw new Error("포지션 슬롯이 이미 마감되어 승인할 수 없습니다.");
        }
      }

      const nextSessions = sessions.map((sess) => {
        if (!targetSessionIds.includes(sess.id)) return sess;
        return {
          ...sess,
          positionSlotCounts: {
            ...(sess.positionSlotCounts ?? {}),
            [key]: currentCounts.get(sess.id)! + 1,
          },
        };
      });

      tx.update(eventRef, { sessions: nextSessions, updatedAt: serverTimestamp() });
      tx.update(appRef, { status: nextStatus });
      return;
    }

    // 기존: 세션 슬롯 기반 승인
    if (!sessionId || !slotId) {
      throw new Error("신청 데이터에 session/slot 정보가 없습니다.");
    }
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
          return { ...slot, applied_count: slot.applied_count + 1 };
        }),
      };
    });
    if (!sessionFound || !slotFound) {
      throw new Error("이벤트의 세션/슬롯을 찾을 수 없습니다.");
    }

    tx.update(eventRef, {
      sessions: nextSessions,
      updatedAt: serverTimestamp(),
    });
    tx.update(appRef, { status: nextStatus });
  });

  try {
    await writeActivityLog({
      action: status === "approved" ? "application_approved" : "application_rejected",
      actorUserId: actorUid,
      targetUserId: typeof appData.userId === "string" ? appData.userId : undefined,
      targetUserName:
        typeof appData.applicantDisplayName === "string"
          ? appData.applicantDisplayName
          : undefined,
      eventTitle:
        typeof appData.eventTitle === "string" ? appData.eventTitle : undefined,
      detail:
        status === "rejected" && options?.rejectionReason?.trim()
          ? options.rejectionReason.trim()
          : undefined,
    });
  } catch {
    // 로그 실패는 승인/거절 자체를 막지 않는다.
  }

  if (status === "approved") {
    const userId = typeof appData.userId === "string" ? appData.userId : "";
    if (userId) {
      try {
        await notifyMemberOnApplicationApproved({
          targetUserId: userId,
          targetEmail:
            typeof appData.applicantEmail === "string"
              ? appData.applicantEmail
              : undefined,
          applicationId,
          eventId: typeof appData.eventId === "string" ? appData.eventId : undefined,
          eventTitle:
            typeof appData.eventTitle === "string" ? appData.eventTitle : "",
          eventDate: typeof appData.date === "string" ? appData.date : "",
          slotTime: typeof appData.slotTime === "string" ? appData.slotTime : "",
          location: typeof appData.venue === "string" ? appData.venue : "",
          createdByUserId: getAuth().currentUser?.uid ?? undefined,
        });
      } catch {
        // 승인은 성공 — 알림만 실패할 수 있음
      }
    }
  }
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
      if (freshData.cancelRequestedAt) {
        throw new Error(
          "이미 취소를 요청했습니다. 관리자 승인을 기다려 주세요.",
        );
      }
      // 승인된 신청은 바로 취소되지 않고, 관리자 승인이 필요한 취소
      // 요청 상태로 전환한다 (정원은 관리자가 승인해야 반환됨).
      tx.update(appRef, { cancelRequestedAt: serverTimestamp() });
    }
  });

  try {
    await notifyAdminsOnApplicationCancelled(notifyPayload);
  } catch {
    // 취소(요청)는 성공 — 알림만 실패할 수 있음
  }
}

/** 관리자: 취소 요청 승인 — 정원 반환 + 신청 삭제 (배정 해제와 동일 로직) */
export async function adminApproveCancelRequest(applicationId: string) {
  const actorUid = await assertAdmin();
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    throw new Error("신청을 찾을 수 없습니다.");
  }
  const appData = appSnap.data() as Record<string, unknown>;
  if (!appData.cancelRequestedAt) {
    throw new Error("취소 요청 상태가 아닙니다.");
  }
  await adminRemoveApprovedApplicant(applicationId);
  try {
    await writeActivityLog({
      action: "application_cancel_approved",
      actorUserId: actorUid,
      targetUserId: typeof appData.userId === "string" ? appData.userId : undefined,
      targetUserName:
        typeof appData.applicantDisplayName === "string"
          ? appData.applicantDisplayName
          : undefined,
      eventTitle:
        typeof appData.eventTitle === "string" ? appData.eventTitle : undefined,
    });
  } catch {
    // 로그 실패는 처리 자체를 막지 않는다.
  }
}

/** 관리자: 취소 요청 거절 — 취소 요청만 취소하고 승인 상태를 유지한다 */
export async function adminRejectCancelRequest(applicationId: string) {
  const actorUid = await assertAdmin();
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    throw new Error("신청을 찾을 수 없습니다.");
  }
  const appData = appSnap.data() as Record<string, unknown>;
  if (!appData.cancelRequestedAt) {
    throw new Error("취소 요청 상태가 아닙니다.");
  }
  await updateDoc(appRef, { cancelRequestedAt: deleteField() });
  try {
    await writeActivityLog({
      action: "application_cancel_rejected",
      actorUserId: actorUid,
      targetUserId: typeof appData.userId === "string" ? appData.userId : undefined,
      targetUserName:
        typeof appData.applicantDisplayName === "string"
          ? appData.applicantDisplayName
          : undefined,
      eventTitle:
        typeof appData.eventTitle === "string" ? appData.eventTitle : undefined,
    });
  } catch {
    // 로그 실패는 처리 자체를 막지 않는다.
  }
}

/** 관리자: 승인된 신청자 배정 해제 (슬롯 정원 복구 후 신청 삭제) */
export async function adminRemoveApprovedApplicant(applicationId: string) {
  await assertAdmin();
  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    throw new Error("신청을 찾을 수 없습니다.");
  }

  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(appRef);
    if (!freshSnap.exists()) {
      throw new Error("신청을 찾을 수 없습니다.");
    }
    const freshData = freshSnap.data() as Record<string, unknown>;
    const freshStatus = normalizeStatus(freshData.status);
    if (freshStatus === "completed") {
      throw new Error("완료된 신청은 배정 해제할 수 없습니다.");
    }

    if (freshStatus !== "approved") {
      tx.delete(appRef);
      return;
    }

    const eventId = typeof freshData.eventId === "string" ? freshData.eventId : "";
    const sessionId = typeof freshData.sessionId === "string" ? freshData.sessionId : "";
    const positionId = typeof freshData.positionId === "string" ? freshData.positionId : "";
    const positionSlotId =
      typeof freshData.positionSlotId === "string" ? freshData.positionSlotId : "";

    if (!eventId) {
      tx.delete(appRef);
      return;
    }

    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) {
      tx.delete(appRef);
      return;
    }
    const eventData = eventSnap.data() as Record<string, unknown>;

    // Option B: 포지션 슬롯 기반 배정 해제 — 승인/취소와 동일하게 세션별로 독립 추적한다.
    if (positionId && positionSlotId) {
      const groupSessionIds = Array.isArray(freshData.groupSessionIds)
        ? (freshData.groupSessionIds as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : [];
      const targetSessionIds = groupSessionIds.length > 0 ? groupSessionIds : [sessionId];

      const sessions = Array.isArray(eventData.sessions)
        ? (eventData.sessions as Session[])
        : [];
      const key = positionSlotKey(positionId, positionSlotId);

      const currentCounts = new Map<string, number>();
      for (const sid of targetSessionIds) {
        const sess = sessions.find((s) => s.id === sid);
        if (!sess) continue;
        const existing = sess.positionSlotCounts?.[key];
        const count =
          existing ??
          (await countApprovedForPositionSlot(eventId, sid, positionId, positionSlotId));
        currentCounts.set(sid, count);
      }

      const nextSessions = sessions.map((sess) => {
        if (!currentCounts.has(sess.id)) return sess;
        return {
          ...sess,
          positionSlotCounts: {
            ...(sess.positionSlotCounts ?? {}),
            [key]: Math.max(0, currentCounts.get(sess.id)! - 1),
          },
        };
      });
      tx.update(eventRef, { sessions: nextSessions, updatedAt: serverTimestamp() });
      tx.delete(appRef);
      return;
    }

    // 기존: 세션 슬롯 기반 배정 해제
    const slotId = typeof freshData.slotId === "string" ? freshData.slotId : "";
    if (!sessionId || !slotId) {
      tx.delete(appRef);
      return;
    }
    const sessions = Array.isArray(eventData.sessions)
      ? (eventData.sessions as EventItem["sessions"])
      : [];
    const nextSessions = sessions.map((sess) => {
      if (sess.id !== sessionId) return sess;
      return {
        ...sess,
        slots: sess.slots.map((slot) => {
          if (slot.id !== slotId) return slot;
          return { ...slot, applied_count: Math.max(0, slot.applied_count - 1) };
        }),
      };
    });
    tx.update(eventRef, { sessions: nextSessions, updatedAt: serverTimestamp() });
    tx.delete(appRef);
  });
}
