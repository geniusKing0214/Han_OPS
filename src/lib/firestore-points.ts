import {
  type FirestoreError,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { APPLICATIONS_COLLECTION } from "@/lib/firestore-applications";
import { USERS_COLLECTION } from "@/lib/firestore-users";
import { monthKeyFromDateYmd, pointsForWorkStatus } from "@/lib/point-policy";
import { db } from "@/lib/firebase";
import type { WorkStatus } from "@/types/points";
import type { PointLogDoc, PointType } from "@/types/points";

export const POINT_LOGS_COLLECTION = "point_logs";

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

function docToPointLog(id: string, data: Record<string, unknown>): PointLogDoc {
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    application_id:
      typeof data.application_id === "string" ? data.application_id : "",
    point_type: (data.point_type as PointType) ?? "adjustment",
    points: typeof data.points === "number" ? data.points : 0,
    reason: typeof data.reason === "string" ? data.reason : "",
    created_by_admin:
      typeof data.created_by_admin === "string" ? data.created_by_admin : "",
    created_at: timestampToIso(data.created_at),
    month_key: typeof data.month_key === "string" ? data.month_key : "",
  };
}

function workStatusToPointType(status: WorkStatus): PointType {
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (status === "late_cancel") return "late_cancel";
  return "adjustment";
}

function workStatusReason(status: WorkStatus, eventTitle: string): string {
  const base = eventTitle.trim() || "스케줄";
  if (status === "completed") return `${base} 근무완료`;
  if (status === "no_show") return `${base} 결근`;
  if (status === "late_cancel") return `${base} 당일취소`;
  return `${base} 근무 상태 변경`;
}

/**
 * 관리자: 신청 건 근무 상태 처리 + 포인트 지급/차감 (중복 지급 방지)
 */
export async function setApplicationWorkStatus(
  applicationId: string,
  workStatus: WorkStatus,
  adminUid: string,
) {
  await assertAdmin();

  if (workStatus === "not_checked") {
    throw new Error("근무 상태를 선택해 주세요.");
  }

  const appRef = doc(db, APPLICATIONS_COLLECTION, applicationId);

  await runTransaction(db, async (tx) => {
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("신청 문서를 찾을 수 없습니다.");
    }
    const appData = appSnap.data() as Record<string, unknown>;
    const userId = typeof appData.userId === "string" ? appData.userId : "";
    if (!userId) throw new Error("신청자 정보가 없습니다.");

    const appStatus = typeof appData.status === "string" ? appData.status : "";
    if (appStatus !== "approved" && appStatus !== "completed") {
      throw new Error("승인된 신청만 근무 처리할 수 있습니다.");
    }

    const prevWork = normalizeWorkStatus(appData.work_status);
    const wasAwarded = Boolean(appData.points_awarded);
    const prevPoints = wasAwarded ? pointsForWorkStatus(prevWork) : 0;
    const nextPoints = pointsForWorkStatus(workStatus);

    if (wasAwarded && prevWork === workStatus) {
      throw new Error("이미 동일한 근무 상태로 처리되었습니다.");
    }

    const delta = nextPoints - prevPoints;
    const eventTitle =
      typeof appData.eventTitle === "string" ? appData.eventTitle : "";
    const dateYmd = typeof appData.date === "string" ? appData.date : "";
    const month_key = monthKeyFromDateYmd(dateYmd);

    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await tx.get(userRef);
    const currentTotal =
      userSnap.exists() &&
      typeof (userSnap.data() as Record<string, unknown>).total_points ===
        "number"
        ? ((userSnap.data() as Record<string, unknown>).total_points as number)
        : 0;

    tx.update(appRef, {
      work_status: workStatus,
      points_awarded: true,
      completed_at: serverTimestamp(),
      completed_by_admin: adminUid,
      status: "completed",
    });

    tx.update(userRef, {
      total_points: currentTotal + delta,
    });

    if (delta !== 0) {
      const logRef = doc(collection(db, POINT_LOGS_COLLECTION));
      tx.set(logRef, {
        user_id: userId,
        application_id: applicationId,
        point_type: workStatusToPointType(workStatus),
        points: delta,
        reason: workStatusReason(workStatus, eventTitle),
        created_by_admin: adminUid,
        created_at: serverTimestamp(),
        month_key,
      });
    }
  });
}

export function subscribePointLogsByMonth(
  monthKey: string,
  onData: (rows: PointLogDoc[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      const q = query(
        collection(db, POINT_LOGS_COLLECTION),
        where("month_key", "==", monthKey),
      );
      innerUnsub = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs
            .map((d) =>
              docToPointLog(d.id, d.data() as Record<string, unknown>),
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          onData(rows);
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

export function subscribePointLogsByUser(
  userId: string,
  monthKey: string | null,
  onData: (rows: PointLogDoc[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  let innerUnsub: (() => void) | undefined;
  let cancelled = false;

  void assertAdmin()
    .then(() => {
      if (cancelled) return;
      const q = monthKey
        ? query(
            collection(db, POINT_LOGS_COLLECTION),
            where("user_id", "==", userId),
            where("month_key", "==", monthKey),
          )
        : query(
            collection(db, POINT_LOGS_COLLECTION),
            where("user_id", "==", userId),
          );
      innerUnsub = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs
            .map((d) =>
              docToPointLog(d.id, d.data() as Record<string, unknown>),
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          onData(rows);
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

/** 관리자: 유저 포인트 수동 지급/차감 */
export async function adjustUserPoints(input: {
  userId: string;
  points: number;
  reason: string;
  monthKey: string;
  adminUid: string;
}) {
  await assertAdmin();

  const delta = Math.trunc(input.points);
  if (!delta) {
    throw new Error("포인트는 0이 아닌 정수여야 합니다.");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("조정 사유를 입력해 주세요.");
  }
  if (!input.monthKey.trim()) {
    throw new Error("적용 월 정보가 없습니다.");
  }

  const userRef = doc(db, USERS_COLLECTION, input.userId);

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    const data = userSnap.data() as Record<string, unknown>;
    const currentTotal =
      typeof data.total_points === "number" ? data.total_points : 0;
    const nextTotal = currentTotal + delta;
    if (nextTotal < 0) {
      throw new Error("누적 포인트가 0 미만이 될 수 없습니다.");
    }

    tx.update(userRef, { total_points: nextTotal });

    const logRef = doc(collection(db, POINT_LOGS_COLLECTION));
    tx.set(logRef, {
      user_id: input.userId,
      application_id: "",
      point_type: "adjustment",
      points: delta,
      reason: reason.startsWith("[관리자 조정]")
        ? reason
        : `[관리자 조정] ${reason}`,
      created_by_admin: input.adminUid,
      created_at: serverTimestamp(),
      month_key: input.monthKey.trim(),
    });
  });
}

/** 관리자: 월간 포인트 로그 일괄 조회 (랭킹 집계용) */
export async function fetchPointLogsByMonth(
  monthKey: string,
): Promise<PointLogDoc[]> {
  await assertAdmin();
  const q = query(
    collection(db, POINT_LOGS_COLLECTION),
    where("month_key", "==", monthKey),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    docToPointLog(d.id, d.data() as Record<string, unknown>),
  );
}
