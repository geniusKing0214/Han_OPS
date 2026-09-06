import {
  type FirestoreError,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { db } from "@/lib/firebase";
import { getClientAuth } from "@/lib/firebase-auth";
import {
  getMonthDates,
  getNextWeekStart,
  getWeekDates,
  getWeekStartMonday,
  getWeekStartsCoveringDates,
  isAvailabilityWindowOpen,
  parseYmd,
} from "@/lib/workforce-dates";
import {
  DEFAULT_AVAILABLE_WEEKDAYS,
  DEFAULT_WEEKLY_MAX,
  WORKFORCE_COLORS,
  type WorkforceAssignStatus,
  type WorkforceAssignmentLog,
  type WorkforceAvailability,
  type WorkforceLogAction,
  type WorkforceMonthlyExportRow,
  type WorkforceSchedule,
  type WorkforceWeekMeta,
  type WeekdayKey,
} from "@/types/workforce";
import { normalizeTeamIds, type TeamId } from "@/types/team";
import type { EventItem, PositionDef } from "@/types/schedule";

export const WORKFORCE_WEEKS = "workforceWeeks";
export const WORKFORCE_SCHEDULES = "workforceSchedules";
export const WORKFORCE_AVAILABILITY = "workforceAvailability";
export const WORKFORCE_AVAILABILITY_EXCLUSIONS = "workforceAvailabilityExclusions";
export const WORKFORCE_LOGS = "workforceLogs";
export const WORKFORCE_MONTHLY_EXPORTS = "workforceMonthlyExports";

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

function parseWeekdays(raw: unknown): Record<WeekdayKey, boolean> {
  const base = { ...DEFAULT_AVAILABLE_WEEKDAYS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(base) as WeekdayKey[]) {
    if (typeof o[k] === "boolean") base[k] = o[k];
  }
  return base;
}

function parseExceptions(
  raw: unknown,
): Record<string, "available" | "unavailable"> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, "available" | "unavailable"> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === "available" || v === "unavailable") out[k] = v;
  }
  return out;
}

function parseExceptionNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

export function docToSchedule(
  id: string,
  data: Record<string, unknown>,
): WorkforceSchedule {
  return {
    id,
    weekStart: typeof data.weekStart === "string" ? data.weekStart : "",
    date: typeof data.date === "string" ? data.date : "",
    title: typeof data.title === "string" ? data.title : "",
    startTime: typeof data.startTime === "string" ? data.startTime : "",
    venue: typeof data.venue === "string" ? data.venue : "",
    requiredCount:
      typeof data.requiredCount === "number" ? data.requiredCount : 0,
    teamIds: normalizeTeamIds(data.teamIds),
    note: typeof data.note === "string" ? data.note : "",
    color: typeof data.color === "string" ? data.color : "#C8A96B",
    assignedUserIds: Array.isArray(data.assignedUserIds)
      ? data.assignedUserIds.filter((x): x is string => typeof x === "string")
      : [],
    positions: Array.isArray(data.positions)
      ? (data.positions as PositionDef[])
      : undefined,
    assigneePositions:
      data.assigneePositions &&
      typeof data.assigneePositions === "object" &&
      !Array.isArray(data.assigneePositions)
        ? (data.assigneePositions as Record<string, string>)
        : undefined,
    status:
      data.status === "confirmed" ||
      data.status === "cancelled" ||
      data.status === "draft"
        ? data.status
        : "draft",
    sourceEventId:
      typeof data.sourceEventId === "string" ? data.sourceEventId : undefined,
    sourceSessionId:
      typeof data.sourceSessionId === "string"
        ? data.sourceSessionId
        : undefined,
    sourceSlotId:
      typeof data.sourceSlotId === "string" ? data.sourceSlotId : undefined,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
  };
}

function parseSubmittedWeeks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x),
  );
}

export function docToAvailability(
  userId: string,
  data: Record<string, unknown>,
): WorkforceAvailability {
  return {
    userId,
    weeklyMaxAssignments:
      typeof data.weeklyMaxAssignments === "number"
        ? data.weeklyMaxAssignments
        : DEFAULT_WEEKLY_MAX,
    availableWeekdays: parseWeekdays(data.availableWeekdays),
    dateExceptions: parseExceptions(data.dateExceptions),
    dateExceptionNotes: parseExceptionNotes(data.dateExceptionNotes),
    memberSubmittedWeeks: parseSubmittedWeeks(data.memberSubmittedWeeks),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function defaultAvailability(userId: string): WorkforceAvailability {
  return {
    userId,
    weeklyMaxAssignments: DEFAULT_WEEKLY_MAX,
    availableWeekdays: { ...DEFAULT_AVAILABLE_WEEKDAYS },
    dateExceptions: {},
    dateExceptionNotes: {},
    memberSubmittedWeeks: [],
    updatedAt: new Date().toISOString(),
  };
}

export function subscribeWorkforceWeek(
  weekStart: string,
  onData: (meta: WorkforceWeekMeta | null) => void,
  onError?: (e: FirestoreError) => void,
) {
  return onSnapshot(
    doc(db, WORKFORCE_WEEKS, weekStart),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      onData({
        weekStart,
        status:
          data.status === "confirmed" ||
          data.status === "cancelled" ||
          data.status === "draft"
            ? data.status
            : "draft",
        confirmedAt:
          typeof data.confirmedAt === "string"
            ? data.confirmedAt
            : data.confirmedAt
              ? timestampToIso(data.confirmedAt)
              : undefined,
        confirmedBy:
          typeof data.confirmedBy === "string" ? data.confirmedBy : undefined,
        updatedAt: timestampToIso(data.updatedAt),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    },
    (err) => onError?.(err),
  );
}

export function subscribeWorkforceSchedules(
  weekStart: string,
  onData: (rows: WorkforceSchedule[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  const q = query(
    collection(db, WORKFORCE_SCHEDULES),
    where("weekStart", "==", weekStart),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => docToSchedule(d.id, d.data() as Record<string, unknown>))
        .filter((s) => s.status !== "cancelled")
        .sort((a, b) =>
          a.date === b.date
            ? a.startTime.localeCompare(b.startTime)
            : a.date.localeCompare(b.date),
        );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

/** 여러 주의 일정을 합쳐 구독 */
export function subscribeWorkforceSchedulesMulti(
  weekStarts: string[],
  onData: (rows: WorkforceSchedule[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  const unique = [...new Set(weekStarts.filter(Boolean))];
  if (unique.length === 0) {
    onData([]);
    return () => {};
  }
  if (unique.length === 1) {
    return subscribeWorkforceSchedules(unique[0]!, onData, onError);
  }

  const byWeek = new Map<string, WorkforceSchedule[]>();
  const unsubs = unique.map((ws) =>
    subscribeWorkforceSchedules(
      ws,
      (rows) => {
        byWeek.set(ws, rows);
        const merged = [...byWeek.values()].flat().sort((a, b) =>
          a.date === b.date
            ? a.startTime.localeCompare(b.startTime)
            : a.date.localeCompare(b.date),
        );
        onData(merged);
      },
      onError,
    ),
  );
  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeAllAvailability(
  onData: (map: Map<string, WorkforceAvailability>) => void,
  onError?: (e: FirestoreError) => void,
) {
  return onSnapshot(
    collection(db, WORKFORCE_AVAILABILITY),
    (snap) => {
      const map = new Map<string, WorkforceAvailability>();
      for (const d of snap.docs) {
        map.set(
          d.id,
          docToAvailability(d.id, d.data() as Record<string, unknown>),
        );
      }
      onData(map);
    },
    (err) => onError?.(err),
  );
}

/**
 * 미신청자 목록에서 카운트 제외 처리된 인원(주 단위, 관리자 공용).
 * 문서 1건 = 1주, `uids` 배열에 제외된 사용자 uid 를 담는다.
 */
export function subscribeAvailabilityExclusions(
  weekStart: string,
  onData: (uids: string[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  return onSnapshot(
    doc(db, WORKFORCE_AVAILABILITY_EXCLUSIONS, weekStart),
    (snap) => {
      const raw = snap.exists()
        ? (snap.data() as Record<string, unknown>).uids
        : null;
      onData(
        Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string")
          : [],
      );
    },
    (err) => onError?.(err),
  );
}

/** 특정 인원을 해당 주의 제외 목록에 추가/해제한다 (관리자 전용). */
export async function setAvailabilityExclusion(
  weekStart: string,
  uid: string,
  excluded: boolean,
): Promise<void> {
  const actorUid = await assertAdmin();
  await setDoc(
    doc(db, WORKFORCE_AVAILABILITY_EXCLUSIONS, weekStart),
    {
      weekStart,
      uids: excluded ? arrayUnion(uid) : arrayRemove(uid),
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true },
  );
}

export async function ensureWeekMeta(
  weekStart: string,
  actorUid: string,
): Promise<void> {
  await assertAdmin();
  const ref = doc(db, WORKFORCE_WEEKS, weekStart);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    weekStart,
    status: "draft",
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}

export async function writeAssignmentLog(input: {
  weekStart: string;
  scheduleId?: string;
  actorUserId: string;
  actorName: string;
  action: WorkforceLogAction;
  targetUserId?: string;
  targetUserName?: string;
  detail?: string;
  reason?: string;
}) {
  const payload: Record<string, unknown> = {
    weekStart: input.weekStart,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: input.action,
    createdAt: serverTimestamp(),
  };
  if (input.scheduleId) payload.scheduleId = input.scheduleId;
  if (input.targetUserId) payload.targetUserId = input.targetUserId;
  if (input.targetUserName) payload.targetUserName = input.targetUserName;
  if (input.detail) payload.detail = input.detail;
  if (input.reason?.trim()) payload.reason = input.reason.trim();

  await addDoc(collection(db, WORKFORCE_LOGS), payload);
}

export async function createWorkforceSchedule(input: {
  weekStart: string;
  date: string;
  title: string;
  startTime: string;
  venue: string;
  requiredCount: number;
  teamIds: TeamId[];
  note: string;
  color: string;
  sourceEventId?: string;
  sourceSessionId?: string;
  sourceSlotId?: string;
  positions?: PositionDef[];
}): Promise<string> {
  const uid = await assertAdmin();
  await ensureWeekMeta(input.weekStart, uid);
  const ref = await addDoc(collection(db, WORKFORCE_SCHEDULES), {
    weekStart: input.weekStart,
    date: input.date,
    title: input.title.trim(),
    startTime: input.startTime,
    venue: input.venue.trim(),
    requiredCount: Math.max(0, Math.floor(input.requiredCount)),
    teamIds: normalizeTeamIds(input.teamIds),
    note: input.note.trim(),
    color: input.color,
    assignedUserIds: [],
    ...(input.positions?.length ? { positions: input.positions } : {}),
    status: "draft",
    ...(input.sourceEventId
      ? {
          sourceEventId: input.sourceEventId,
          sourceSessionId: input.sourceSessionId ?? "",
          sourceSlotId: input.sourceSlotId ?? "",
        }
      : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
  await writeAssignmentLog({
    weekStart: input.weekStart,
    scheduleId: ref.id,
    actorUserId: uid,
    actorName: "",
    action: "create_schedule",
    detail: input.title.trim(),
  });
  return ref.id;
}

export async function updateWorkforceSchedule(
  scheduleId: string,
  patch: Partial<{
    title: string;
    date: string;
    startTime: string;
    venue: string;
    requiredCount: number;
    teamIds: TeamId[];
    note: string;
    color: string;
  }>,
): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_SCHEDULES, scheduleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("일정을 찾을 수 없습니다.");
  const prev = docToSchedule(scheduleId, snap.data() as Record<string, unknown>);
  await updateDoc(ref, {
    ...patch,
    ...(patch.teamIds ? { teamIds: normalizeTeamIds(patch.teamIds) } : {}),
    updatedAt: serverTimestamp(),
  });
  await writeAssignmentLog({
    weekStart: prev.weekStart,
    scheduleId,
    actorUserId: uid,
    actorName: "",
    action: "update_schedule",
    detail: prev.title,
  });
}

export async function deleteWorkforceSchedule(scheduleId: string): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_SCHEDULES, scheduleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const prev = docToSchedule(scheduleId, snap.data() as Record<string, unknown>);
  await deleteDoc(ref);
  await writeAssignmentLog({
    weekStart: prev.weekStart,
    scheduleId,
    actorUserId: uid,
    actorName: "",
    action: "delete_schedule",
    detail: prev.title,
  });
}

export async function duplicateWorkforceSchedule(
  scheduleId: string,
  targetDate?: string,
): Promise<string> {
  const uid = await assertAdmin();
  const snap = await getDoc(doc(db, WORKFORCE_SCHEDULES, scheduleId));
  if (!snap.exists()) throw new Error("일정을 찾을 수 없습니다.");
  const src = docToSchedule(scheduleId, snap.data() as Record<string, unknown>);
  const id = await createWorkforceSchedule({
    weekStart: src.weekStart,
    date: targetDate || src.date,
    title: `${src.title} (복제)`,
    startTime: src.startTime,
    venue: src.venue,
    requiredCount: src.requiredCount,
    teamIds: src.teamIds,
    note: src.note,
    color: src.color,
  });
  await writeAssignmentLog({
    weekStart: src.weekStart,
    scheduleId: id,
    actorUserId: uid,
    actorName: "",
    action: "duplicate_schedule",
    detail: src.title,
  });
  return id;
}

export async function setScheduleAssignees(
  scheduleId: string,
  /** 현재 커밋된 assignedUserIds → 다음 assignedUserIds. 동시 수정 시 유실을 막기 위해
   * 절대값이 아닌 델타(함수)로 받아 트랜잭션 안에서 최신 상태 기준으로 적용한다. */
  computeNextAssignees: (current: string[]) => string[],
  meta?: {
    action?: WorkforceLogAction;
    targetUserId?: string;
    targetUserName?: string;
    reason?: string;
    detail?: string;
    /** userId → positionLabel 패치 (기존 값과 병합) */
    assigneePositionsPatch?: Record<string, string | null>;
  },
): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_SCHEDULES, scheduleId);
  let prevWeekStart = "";
  let prevTitle = "";

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("일정을 찾을 수 없습니다.");
    const prev = docToSchedule(scheduleId, snap.data() as Record<string, unknown>);
    prevWeekStart = prev.weekStart;
    prevTitle = prev.title;
    const unique = [...new Set(computeNextAssignees(prev.assignedUserIds))];

    // 포지션 패치 처리: null이면 삭제, 값이면 업데이트
    let mergedPositions: Record<string, string> | undefined;
    if (meta?.assigneePositionsPatch) {
      const base: Record<string, string> = { ...(prev.assigneePositions ?? {}) };
      for (const [userId, pos] of Object.entries(meta.assigneePositionsPatch)) {
        if (pos === null) {
          delete base[userId];
        } else {
          base[userId] = pos;
        }
      }
      // 배정 해제된 유저의 포지션도 제거
      for (const userId of Object.keys(base)) {
        if (!unique.includes(userId)) delete base[userId];
      }
      mergedPositions = base;
    } else if (prev.assigneePositions) {
      // 배정 해제된 유저 포지션만 정리
      const base = { ...prev.assigneePositions };
      for (const userId of Object.keys(base)) {
        if (!unique.includes(userId)) delete base[userId];
      }
      mergedPositions = base;
    }

    tx.update(ref, {
      assignedUserIds: unique,
      ...(mergedPositions !== undefined
        ? { assigneePositions: mergedPositions }
        : {}),
      updatedAt: serverTimestamp(),
    });
  });

  await writeAssignmentLog({
    weekStart: prevWeekStart,
    scheduleId,
    actorUserId: uid,
    actorName: "",
    action: meta?.action ?? "assign",
    targetUserId: meta?.targetUserId,
    targetUserName: meta?.targetUserName,
    reason: meta?.reason,
    detail: meta?.detail ?? prevTitle,
  });
}

export async function saveWeekDraft(weekStart: string): Promise<void> {
  const uid = await assertAdmin();
  await ensureWeekMeta(weekStart, uid);
  await updateDoc(doc(db, WORKFORCE_WEEKS, weekStart), {
    status: "draft",
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await writeAssignmentLog({
    weekStart,
    actorUserId: uid,
    actorName: "",
    action: "save_draft",
  });
}

export async function confirmWorkforceWeek(weekStart: string): Promise<{
  schedules: WorkforceSchedule[];
}> {
  const uid = await assertAdmin();
  await ensureWeekMeta(weekStart, uid);
  const q = query(
    collection(db, WORKFORCE_SCHEDULES),
    where("weekStart", "==", weekStart),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  const schedules: WorkforceSchedule[] = [];
  for (const d of snap.docs) {
    const s = docToSchedule(d.id, d.data() as Record<string, unknown>);
    if (s.status === "cancelled") continue;
    batch.update(d.ref, {
      status: "confirmed",
      updatedAt: serverTimestamp(),
    });
    schedules.push({ ...s, status: "confirmed" });
  }
  batch.set(
    doc(db, WORKFORCE_WEEKS, weekStart),
    {
      weekStart,
      status: "confirmed",
      confirmedAt: serverTimestamp(),
      confirmedBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true },
  );
  await batch.commit();
  await writeAssignmentLog({
    weekStart,
    actorUserId: uid,
    actorName: "",
    action: "confirm_week",
    detail: `${schedules.length}개 일정`,
  });
  return { schedules };
}

export async function resetWorkforceWeek(weekStart: string): Promise<{
  wasConfirmed: boolean;
  schedules: WorkforceSchedule[];
}> {
  const uid = await assertAdmin();
  const weekSnap = await getDoc(doc(db, WORKFORCE_WEEKS, weekStart));
  const wasConfirmed =
    weekSnap.exists() && weekSnap.data().status === "confirmed";
  const q = query(
    collection(db, WORKFORCE_SCHEDULES),
    where("weekStart", "==", weekStart),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  const schedules: WorkforceSchedule[] = [];
  for (const d of snap.docs) {
    schedules.push(docToSchedule(d.id, d.data() as Record<string, unknown>));
    batch.delete(d.ref);
  }
  batch.set(
    doc(db, WORKFORCE_WEEKS, weekStart),
    {
      weekStart,
      status: "draft",
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true },
  );
  await batch.commit();
  await writeAssignmentLog({
    weekStart,
    actorUserId: uid,
    actorName: "",
    action: "reset_week",
  });
  return { wasConfirmed, schedules };
}

export async function upsertAvailability(
  userId: string,
  patch: Partial<{
    weeklyMaxAssignments: number;
    availableWeekdays: Record<WeekdayKey, boolean>;
    dateExceptions: Record<string, "available" | "unavailable">;
    memberSubmittedWeeks: string[];
  }>,
  opts?: { mergeExceptions?: boolean },
): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_AVAILABILITY, userId);
  const snap = await getDoc(ref);
  const prev = snap.exists()
    ? docToAvailability(userId, snap.data() as Record<string, unknown>)
    : defaultAvailability(userId);
  const mergeExceptions = opts?.mergeExceptions !== false;
  const nextExceptions =
    patch.dateExceptions === undefined
      ? prev.dateExceptions
      : mergeExceptions
        ? { ...prev.dateExceptions, ...patch.dateExceptions }
        : patch.dateExceptions;
  await setDoc(
    ref,
    {
      userId,
      weeklyMaxAssignments:
        patch.weeklyMaxAssignments ?? prev.weeklyMaxAssignments,
      availableWeekdays: patch.availableWeekdays ?? prev.availableWeekdays,
      dateExceptions: nextExceptions,
      memberSubmittedWeeks:
        patch.memberSubmittedWeeks ?? prev.memberSubmittedWeeks,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true },
  );
  await writeAssignmentLog({
    weekStart: "",
    actorUserId: uid,
    actorName: "",
    action: "update_availability",
    targetUserId: userId,
  });
}

/** 멤버 본인 — 익주 가능일만 신청. 신청 기간(화·수·목·금) 외에는 수정 불가. */
export async function upsertMyAvailability(input: {
  weekStart: string;
  dateExceptions: Record<string, "available" | "unavailable">;
  /** YYYY-MM-DD → 불가 사유 메모 (근무 불가로 표시한 날짜만 전달) */
  dateExceptionNotes?: Record<string, string>;
}): Promise<void> {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  if (!isAvailabilityWindowOpen()) {
    throw new Error(
      "신청 기간이 아닙니다. 근무 가능일은 이번 주 화·수·목·금요일에만 신청할 수 있습니다.",
    );
  }

  const allowedWeek = getNextWeekStart();
  if (input.weekStart !== allowedWeek) {
    throw new Error("근무 가능일은 익주만 신청할 수 있습니다.");
  }

  const allowedDates = new Set(getWeekDates(allowedWeek));
  for (const date of Object.keys(input.dateExceptions)) {
    if (!allowedDates.has(date)) {
      throw new Error("익주 날짜만 저장할 수 있습니다.");
    }
  }
  for (const date of Object.keys(input.dateExceptionNotes ?? {})) {
    if (!allowedDates.has(date)) {
      throw new Error("익주 날짜만 저장할 수 있습니다.");
    }
  }

  const ref = doc(db, WORKFORCE_AVAILABILITY, uid);
  const snap = await getDoc(ref);
  const prev = snap.exists()
    ? docToAvailability(uid, snap.data() as Record<string, unknown>)
    : defaultAvailability(uid);

  // 화~금 신청 기간 중에는 이미 제출했어도 재저장 허용
  // (토요일 이후 잠금은 isAvailabilityWindowOpen() 체크가 위에서 처리)

  const nextExceptions = {
    ...prev.dateExceptions,
    ...input.dateExceptions,
  };

  // 불가 사유 메모: 근무 불가로 표시된 날짜만 유지, 가능으로 바뀌면 메모 제거
  const nextNotes: Record<string, string> = { ...prev.dateExceptionNotes };
  for (const [date, status] of Object.entries(input.dateExceptions)) {
    if (status === "available") {
      delete nextNotes[date];
      continue;
    }
    const note = input.dateExceptionNotes?.[date];
    if (typeof note === "string") {
      if (note.trim()) nextNotes[date] = note.trim();
      else delete nextNotes[date];
    }
  }
  for (const date of Object.keys(nextNotes)) {
    if (nextExceptions[date] !== "unavailable") delete nextNotes[date];
  }

  const memberSubmittedWeeks = [
    ...new Set([...prev.memberSubmittedWeeks, allowedWeek]),
  ].sort();

  await setDoc(
    ref,
    {
      userId: uid,
      weeklyMaxAssignments: prev.weeklyMaxAssignments,
      availableWeekdays: prev.availableWeekdays,
      dateExceptions: nextExceptions,
      dateExceptionNotes: nextNotes,
      memberSubmittedWeeks,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true },
  );

  try {
    await writeAssignmentLog({
      weekStart: allowedWeek,
      actorUserId: uid,
      actorName: "",
      action: "member_submit_availability",
      targetUserId: uid,
      detail: `가능 ${Object.values(input.dateExceptions).filter((v) => v === "available").length}/7일`,
    });
  } catch {
    // 감사 로그 실패는 신청 자체를 막지 않는다.
  }
}

export function subscribeMyAvailability(
  userId: string,
  onData: (row: WorkforceAvailability) => void,
  onError?: (e: FirestoreError) => void,
) {
  return onSnapshot(
    doc(db, WORKFORCE_AVAILABILITY, userId),
    (snap) => {
      if (!snap.exists()) {
        onData(defaultAvailability(userId));
        return;
      }
      onData(
        docToAvailability(userId, snap.data() as Record<string, unknown>),
      );
    },
    (err) => onError?.(err),
  );
}

/** 해당 월(YYYY-MM)에 속한 일정만 삭제 */
export async function deleteSchedulesInMonth(yearMonth: string): Promise<{
  deleted: number;
  cancelledSchedules: WorkforceSchedule[];
}> {
  const uid = await assertAdmin();
  const monthDates = new Set(getMonthDates(yearMonth));
  const weekStarts = getWeekStartsCoveringDates([...monthDates]);
  let deleted = 0;
  const cancelledSchedules: WorkforceSchedule[] = [];

  for (const ws of weekStarts) {
    const weekSnap = await getDoc(doc(db, WORKFORCE_WEEKS, ws));
    const wasConfirmed =
      weekSnap.exists() && weekSnap.data().status === "confirmed";
    const snap = await getDocs(
      query(
        collection(db, WORKFORCE_SCHEDULES),
        where("weekStart", "==", ws),
      ),
    );
    const toDelete = snap.docs.filter((d) => {
      const date = (d.data() as { date?: string }).date;
      return typeof date === "string" && monthDates.has(date);
    });
    if (wasConfirmed) {
      for (const d of toDelete) {
        cancelledSchedules.push(
          docToSchedule(d.id, d.data() as Record<string, unknown>),
        );
      }
    }
    for (let i = 0; i < toDelete.length; i += 400) {
      const chunk = toDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit();
      deleted += chunk.length;
    }
  }

  await writeAssignmentLog({
    weekStart: weekStarts[0] ?? "",
    actorUserId: uid,
    actorName: "",
    action: "reset_week",
    detail: `${yearMonth} 월 일정 ${deleted}건 삭제`,
  });
  return { deleted, cancelledSchedules };
}

export async function exportWeekToMonthlySheet(input: {
  weekStart: string;
  schedules: WorkforceSchedule[];
  nameByUid: Map<string, string>;
  teamByUid: Map<string, TeamId>;
  yearMonth: string;
}): Promise<string> {
  const uid = await assertAdmin();
  const rows: WorkforceMonthlyExportRow[] = [];
  for (const s of input.schedules) {
    if (s.status === "cancelled") continue;
    for (const userId of s.assignedUserIds) {
      rows.push({
        userId,
        userName: input.nameByUid.get(userId) || userId,
        teamId: input.teamByUid.get(userId) || "team_1",
        date: s.date,
        title: s.title,
        startTime: s.startTime,
        venue: s.venue,
        note: s.note,
        status: s.status,
      });
    }
  }
  const ref = await addDoc(collection(db, WORKFORCE_MONTHLY_EXPORTS), {
    yearMonth: input.yearMonth,
    weekStart: input.weekStart,
    exportedAt: serverTimestamp(),
    exportedBy: uid,
    rows,
  });
  await writeAssignmentLog({
    weekStart: input.weekStart,
    actorUserId: uid,
    actorName: "",
    action: "export_monthly",
    detail: `${rows.length}행 → ${input.yearMonth}`,
  });
  return ref.id;
}

export function subscribeMyConfirmedSchedules(
  userId: string,
  weekStart: string,
  onData: (rows: WorkforceSchedule[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  const q = query(
    collection(db, WORKFORCE_SCHEDULES),
    where("weekStart", "==", weekStart),
    where("status", "==", "confirmed"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => docToSchedule(d.id, d.data() as Record<string, unknown>))
        .filter((s) => s.assignedUserIds.includes(userId))
        .sort((a, b) =>
          a.date === b.date
            ? a.startTime.localeCompare(b.startTime)
            : a.date.localeCompare(b.date),
        );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export function subscribeRecentLogs(
  weekStart: string,
  onData: (rows: WorkforceAssignmentLog[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  const q = query(
    collection(db, WORKFORCE_LOGS),
    where("weekStart", "==", weekStart),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            weekStart:
              typeof data.weekStart === "string" ? data.weekStart : "",
            scheduleId:
              typeof data.scheduleId === "string" ? data.scheduleId : undefined,
            actorUserId:
              typeof data.actorUserId === "string" ? data.actorUserId : "",
            actorName: typeof data.actorName === "string" ? data.actorName : "",
            action: data.action as WorkforceLogAction,
            targetUserId:
              typeof data.targetUserId === "string"
                ? data.targetUserId
                : undefined,
            targetUserName:
              typeof data.targetUserName === "string"
                ? data.targetUserName
                : undefined,
            detail: typeof data.detail === "string" ? data.detail : undefined,
            reason: typeof data.reason === "string" ? data.reason : undefined,
            createdAt: timestampToIso(data.createdAt),
          } satisfies WorkforceAssignmentLog;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50);
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export type { WorkforceAssignStatus };

export function sourceSlotKey(
  eventId: string,
  sessionId: string,
  slotId: string,
) {
  return `${eventId}:${sessionId}:${slotId}`;
}

/** 이벤트 세션 단위 키 (슬롯 여러 개여도 배정 카드 1개) */
export function sourceSessionKey(eventId: string, sessionId: string) {
  return `${eventId}:${sessionId}`;
}

/** 세션 병합 슬롯 id — 슬롯별 중복 카드 방지 */
export const MERGED_SLOT_ID = "__session__";

function normalizeSessionDate(raw: string): string {
  return raw.trim().slice(0, 10);
}

export type WeekEventSessionRow = {
  event: EventItem;
  sessionId: string;
  date: string;
  startTime: string;
  requiredCount: number;
};

/** 주간 세션을 이벤트×세션당 1건으로 취합 (동일 시간 슬롯 중복 제거) */
export function listEventSessionsInWeek(
  weekDates: string[],
  events: EventItem[],
): WeekEventSessionRow[] {
  const dateSet = new Set(weekDates.map((d) => d.trim()));
  const out: WeekEventSessionRow[] = [];

  for (const event of events) {
    for (const session of event.sessions) {
      const date = normalizeSessionDate(session.date || "");
      if (!date || !dateSet.has(date)) continue;

      const slots = session.slots ?? [];
      if (slots.length === 0) {
        // 포지션 기반 이벤트: 전체 포지션 정원 합산, 가장 이른 시간
        const totalCapacity =
          event.usePositions && event.positions?.length
            ? event.positions.reduce(
                (sum, pos) =>
                  sum +
                  (pos.slots?.reduce(
                    (s, sl) => s + (sl.capacity ?? 0),
                    0,
                  ) ?? 0),
                0,
              )
            : 0;
        const allPositionSlots = (event.positions ?? []).flatMap(
          (p) => p.slots ?? [],
        );
        const allTimes = allPositionSlots
          .filter((s) => !s.timeUndetermined)
          .map((s) => s.time)
          .filter(Boolean)
          .sort();
        const startTime =
          allTimes[0] ??
          (allPositionSlots.length > 0 &&
          allPositionSlots.every((s) => s.timeUndetermined)
            ? "시간 미정"
            : "10:00");
        out.push({
          event,
          sessionId: session.id,
          date,
          startTime,
          requiredCount: Math.max(1, totalCapacity),
        });
        continue;
      }

      // 같은 start_time 슬롯은 정원만 합산 (중복 카드 방지) — 시간 미정 슬롯은 따로 합산
      const byTime = new Map<string, number>();
      let undeterminedCount = 0;
      for (const slot of slots) {
        if (slot.timeUndetermined) {
          undeterminedCount += Math.max(0, slot.capacity || 0);
          continue;
        }
        const t = (slot.start_time || "10:00").trim() || "10:00";
        byTime.set(t, (byTime.get(t) ?? 0) + Math.max(0, slot.capacity || 0));
      }

      // 세션당 카드 1개: 가장 이른 시간 + 전체 정원 합 (전부 미정이면 "시간 미정")
      const times = [...byTime.keys()].sort();
      const startTime = times[0] ?? (undeterminedCount > 0 ? "시간 미정" : "10:00");
      const requiredCount =
        [...byTime.values()].reduce((a, b) => a + b, 0) + undeterminedCount;

      out.push({
        event,
        sessionId: session.id,
        date,
        startTime,
        requiredCount: Math.max(1, requiredCount),
      });
    }
  }

  return out;
}

/** @deprecated use listEventSessionsInWeek */
export function listEventSlotsInWeek(
  weekDates: string[],
  events: EventItem[],
): {
  event: EventItem;
  sessionId: string;
  date: string;
  slot: { id: string; start_time: string; capacity: number };
}[] {
  return listEventSessionsInWeek(weekDates, events).map((row) => ({
    event: row.event,
    sessionId: row.sessionId,
    date: row.date,
    slot: {
      id: MERGED_SLOT_ID,
      start_time: row.startTime,
      capacity: row.requiredCount,
    },
  }));
}

/** 스케줄 events + 인력배정 문서를 한 주 달력용으로 합칩니다. */
export function mergeWeekSchedulesWithEvents(
  weekStart: string,
  weekDates: string[],
  events: EventItem[],
  existing: WorkforceSchedule[],
): WorkforceSchedule[] {
  // 세션 단위로 existing 매칭 (옛 슬롯별 문서도 같은 세션이면 하나로 묶음)
  const existingBySession = new Map<string, WorkforceSchedule[]>();
  for (const s of existing) {
    if (!s.sourceEventId || !s.sourceSessionId) continue;
    const key = sourceSessionKey(s.sourceEventId, s.sourceSessionId);
    const list = existingBySession.get(key) ?? [];
    list.push(s);
    existingBySession.set(key, list);
  }

  const merged: WorkforceSchedule[] = [];
  const usedIds = new Set<string>();
  let colorIdx = 0;

  for (const row of listEventSessionsInWeek(weekDates, events)) {
    const key = sourceSessionKey(row.event.id, row.sessionId);
    const linkedList = existingBySession.get(key) ?? [];
    const color =
      row.event.color?.trim() ||
      linkedList[0]?.color ||
      WORKFORCE_COLORS[colorIdx % WORKFORCE_COLORS.length];
    colorIdx += 1;

    if (linkedList.length > 0) {
      // 배정자 합치고, 대표 문서는 merged 슬롯 또는 첫 문서
      const primary =
        linkedList.find((s) => s.sourceSlotId === MERGED_SLOT_ID) ??
        linkedList[0]!;
      const assigneeSet = new Set<string>();
      for (const s of linkedList) {
        usedIds.add(s.id);
        for (const uid of s.assignedUserIds) assigneeSet.add(uid);
      }
      const eventPositions =
        row.event.usePositions && row.event.positions?.some((p) => p.label?.trim())
          ? row.event.positions
          : undefined;
      merged.push({
        ...primary,
        title: row.event.title || primary.title,
        venue: row.event.venue || primary.venue,
        startTime: row.startTime || primary.startTime,
        requiredCount: row.requiredCount,
        teamIds: normalizeTeamIds(row.event.team_ids),
        note: row.event.notice?.trim() || primary.note,
        color,
        date: row.date,
        assignedUserIds: [...assigneeSet],
        sourceEventId: row.event.id,
        sourceSessionId: row.sessionId,
        sourceSlotId: MERGED_SLOT_ID,
        // 이벤트 포지션 항상 최신 상태로 유지 (usePositions=true일 때만)
        ...(eventPositions ? { positions: eventPositions } : {}),
      });
    } else {
      const eventPositions =
        row.event.usePositions && row.event.positions?.some((p) => p.label?.trim())
          ? row.event.positions
          : undefined;
      merged.push({
        id: `virtual:${key}`,
        weekStart: getWeekStartMonday(parseYmd(row.date)),
        date: row.date,
        title: row.event.title,
        startTime: row.startTime,
        venue: row.event.venue,
        requiredCount: row.requiredCount,
        teamIds: normalizeTeamIds(row.event.team_ids),
        note: row.event.notice?.trim() || "",
        color,
        assignedUserIds: [],
        status: "draft",
        sourceEventId: row.event.id,
        sourceSessionId: row.sessionId,
        sourceSlotId: MERGED_SLOT_ID,
        createdAt: "",
        updatedAt: "",
        createdBy: "",
        // 이벤트 포지션 전달 (virtual 상태에서도 포지션 드롭다운 표시)
        ...(eventPositions ? { positions: eventPositions } : {}),
      });
    }
  }

  for (const s of existing) {
    if (usedIds.has(s.id)) continue;
    // 스케줄 연동인데 이미 세션 병합에 포함된 슬롯 문서는 스킵
    if (s.sourceEventId && s.sourceSessionId) {
      const siblings =
        existingBySession.get(
          sourceSessionKey(s.sourceEventId, s.sourceSessionId),
        ) ?? [];
      if (siblings.some((x) => usedIds.has(x.id))) continue;
    }
    merged.push(s);
  }

  return merged.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
}

/** 해당 주에 있는 events 세션 중, 아직 인력배정에 없는 항목만 가져옵니다. */
export async function importEventsForWeek(input: {
  weekStart: string;
  weekDates: string[];
  events: EventItem[];
  existing: WorkforceSchedule[];
}): Promise<{ imported: number; skipped: number; cleaned: number }> {
  const uid = await assertAdmin();
  await ensureWeekMeta(input.weekStart, uid);

  // 기존 슬롯별 중복 문서 → 세션당 1개로 정리
  const cleaned = await cleanupDuplicateSessionSchedules(input.existing);

  const snap = await getDocs(
    query(
      collection(db, WORKFORCE_SCHEDULES),
      where("weekStart", "==", input.weekStart),
    ),
  );
  const freshExisting = snap.docs
    .map((d) => docToSchedule(d.id, d.data() as Record<string, unknown>))
    .filter((s) => s.status !== "cancelled");

  const existingSessionKeys = new Set(
    freshExisting
      .filter((s) => s.sourceEventId && s.sourceSessionId)
      .map((s) => sourceSessionKey(s.sourceEventId!, s.sourceSessionId!)),
  );

  let imported = 0;
  let skipped = 0;
  let colorIdx = 0;

  for (const row of listEventSessionsInWeek(input.weekDates, input.events)) {
    const key = sourceSessionKey(row.event.id, row.sessionId);
    if (existingSessionKeys.has(key)) {
      skipped += 1;
      continue;
    }
    const color =
      row.event.color?.trim() ||
      WORKFORCE_COLORS[colorIdx % WORKFORCE_COLORS.length];
    colorIdx += 1;
    await createWorkforceSchedule({
      weekStart: input.weekStart,
      date: row.date,
      title: row.event.title,
      startTime: row.startTime,
      venue: row.event.venue,
      requiredCount: row.requiredCount,
      teamIds: normalizeTeamIds(row.event.team_ids),
      note: row.event.notice?.trim() || "",
      color,
      sourceEventId: row.event.id,
      sourceSessionId: row.sessionId,
      sourceSlotId: MERGED_SLOT_ID,
      ...(row.event.usePositions && row.event.positions?.some((p) => p.label?.trim())
        ? { positions: row.event.positions }
        : {}),
    });
    existingSessionKeys.add(key);
    imported += 1;
  }

  if (imported > 0 || cleaned > 0) {
    await writeAssignmentLog({
      weekStart: input.weekStart,
      actorUserId: uid,
      actorName: "",
      action: "import_events",
      detail: `가져옴 ${imported} · 중복스킵 ${skipped} · 정리 ${cleaned}`,
    });
  }

  return { imported, skipped, cleaned };
}

/** DB에 세션당 2개 이상 문서가 남아 있는지 */
export function hasDuplicateSessionSchedules(
  existing: WorkforceSchedule[],
): boolean {
  const seen = new Map<string, number>();
  for (const s of existing) {
    if (!s.sourceEventId || !s.sourceSessionId) continue;
    const key = sourceSessionKey(s.sourceEventId, s.sourceSessionId);
    const n = (seen.get(key) ?? 0) + 1;
    if (n > 1) return true;
    seen.set(key, n);
    if (s.sourceSlotId && s.sourceSlotId !== MERGED_SLOT_ID) return true;
  }
  return false;
}

/** 같은 이벤트 세션에 묶인 슬롯별 문서들을 1개로 병합·삭제 */
export async function cleanupDuplicateSessionSchedules(
  existing: WorkforceSchedule[],
): Promise<number> {
  await assertAdmin();
  const groups = new Map<string, WorkforceSchedule[]>();
  for (const s of existing) {
    if (!s.sourceEventId || !s.sourceSessionId) continue;
    const key = sourceSessionKey(s.sourceEventId, s.sourceSessionId);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  let cleaned = 0;
  for (const [, list] of groups) {
    if (list.length <= 1) {
      // 슬롯 id만 옛 형식이면 MERGED 로 정규화
      const only = list[0];
      if (only && only.sourceSlotId !== MERGED_SLOT_ID) {
        await updateDoc(doc(db, WORKFORCE_SCHEDULES, only.id), {
          sourceSlotId: MERGED_SLOT_ID,
          updatedAt: serverTimestamp(),
        });
      }
      continue;
    }

    const primary =
      list.find((s) => s.sourceSlotId === MERGED_SLOT_ID) ?? list[0]!;
    const assigneeSet = new Set<string>();
    let required = 0;
    let startTime = primary.startTime;
    for (const s of list) {
      for (const uid of s.assignedUserIds) assigneeSet.add(uid);
      // 옛 슬롯별 문서는 정원 합산, 이미 병합된 문서는 합치지 않음
      if (s.sourceSlotId === MERGED_SLOT_ID) {
        required = Math.max(required, s.requiredCount);
      } else {
        required += Math.max(0, s.requiredCount);
      }
      if (s.startTime && (!startTime || s.startTime < startTime)) {
        startTime = s.startTime;
      }
    }

    await updateDoc(doc(db, WORKFORCE_SCHEDULES, primary.id), {
      assignedUserIds: [...assigneeSet],
      requiredCount: Math.max(1, required),
      startTime,
      sourceSlotId: MERGED_SLOT_ID,
      updatedAt: serverTimestamp(),
    });

    for (const s of list) {
      if (s.id === primary.id) continue;
      await deleteDoc(doc(db, WORKFORCE_SCHEDULES, s.id));
      cleaned += 1;
    }
  }
  return cleaned;
}

/** 이번 주 스케줄에 아직 없는 이벤트 세션 개수 */
export function countPendingEventImports(
  weekDates: string[],
  events: EventItem[],
  existing: WorkforceSchedule[],
): number {
  const existingKeys = new Set(
    existing
      .filter((s) => s.sourceEventId && s.sourceSessionId)
      .map((s) => sourceSessionKey(s.sourceEventId!, s.sourceSessionId!)),
  );
  let n = 0;
  for (const row of listEventSessionsInWeek(weekDates, events)) {
    if (!existingKeys.has(sourceSessionKey(row.event.id, row.sessionId))) {
      n += 1;
    }
  }
  return n;
}

export async function ensureWorkforceSchedulePersisted(
  schedule: WorkforceSchedule,
): Promise<string> {
  if (!schedule.id.startsWith("virtual:")) return schedule.id;
  return createWorkforceSchedule({
    weekStart: schedule.weekStart,
    date: schedule.date,
    title: schedule.title,
    startTime: schedule.startTime,
    venue: schedule.venue,
    requiredCount: schedule.requiredCount,
    teamIds: schedule.teamIds,
    note: schedule.note,
    color: schedule.color,
    sourceEventId: schedule.sourceEventId,
    sourceSessionId: schedule.sourceSessionId,
    sourceSlotId: schedule.sourceSlotId ?? MERGED_SLOT_ID,
  });
}
