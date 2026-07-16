import {
  type FirestoreError,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { db } from "@/lib/firebase";
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
import type { EventItem } from "@/types/schedule";

export const WORKFORCE_WEEKS = "workforceWeeks";
export const WORKFORCE_SCHEDULES = "workforceSchedules";
export const WORKFORCE_AVAILABILITY = "workforceAvailability";
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
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function defaultAvailability(userId: string): WorkforceAvailability {
  return {
    userId,
    weeklyMaxAssignments: DEFAULT_WEEKLY_MAX,
    availableWeekdays: { ...DEFAULT_AVAILABLE_WEEKDAYS },
    dateExceptions: {},
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
  await addDoc(collection(db, WORKFORCE_LOGS), {
    ...input,
    createdAt: serverTimestamp(),
  });
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
  assignedUserIds: string[],
  meta?: {
    action?: WorkforceLogAction;
    targetUserId?: string;
    targetUserName?: string;
    reason?: string;
    detail?: string;
  },
): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_SCHEDULES, scheduleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("일정을 찾을 수 없습니다.");
  const prev = docToSchedule(scheduleId, snap.data() as Record<string, unknown>);
  const unique = [...new Set(assignedUserIds)];
  await updateDoc(ref, {
    assignedUserIds: unique,
    updatedAt: serverTimestamp(),
  });
  await writeAssignmentLog({
    weekStart: prev.weekStart,
    scheduleId,
    actorUserId: uid,
    actorName: "",
    action: meta?.action ?? "assign",
    targetUserId: meta?.targetUserId,
    targetUserName: meta?.targetUserName,
    reason: meta?.reason,
    detail: meta?.detail ?? prev.title,
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

export async function resetWorkforceWeek(weekStart: string): Promise<void> {
  const uid = await assertAdmin();
  const q = query(
    collection(db, WORKFORCE_SCHEDULES),
    where("weekStart", "==", weekStart),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  for (const d of snap.docs) {
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
}

export async function upsertAvailability(
  userId: string,
  patch: Partial<{
    weeklyMaxAssignments: number;
    availableWeekdays: Record<WeekdayKey, boolean>;
    dateExceptions: Record<string, "available" | "unavailable">;
  }>,
): Promise<void> {
  const uid = await assertAdmin();
  const ref = doc(db, WORKFORCE_AVAILABILITY, userId);
  const snap = await getDoc(ref);
  const prev = snap.exists()
    ? docToAvailability(userId, snap.data() as Record<string, unknown>)
    : defaultAvailability(userId);
  await setDoc(
    ref,
    {
      userId,
      weeklyMaxAssignments:
        patch.weeklyMaxAssignments ?? prev.weeklyMaxAssignments,
      availableWeekdays: patch.availableWeekdays ?? prev.availableWeekdays,
      dateExceptions: patch.dateExceptions ?? prev.dateExceptions,
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

function normalizeSessionDate(raw: string): string {
  return raw.trim().slice(0, 10);
}

/** 세션에 슬롯이 없으면 일정 1개로 취급 (달력 점과 동일 기준) */
function slotsForSession(session: {
  id: string;
  date: string;
  slots: { id: string; start_time: string; capacity: number }[];
}) {
  if (session.slots.length > 0) return session.slots;
  return [
    {
      id: `${session.id}__default`,
      start_time: "10:00",
      capacity: 1,
    },
  ];
}

export function listEventSlotsInWeek(
  weekDates: string[],
  events: EventItem[],
): {
  event: EventItem;
  sessionId: string;
  date: string;
  slot: { id: string; start_time: string; capacity: number };
}[] {
  const dateSet = new Set(weekDates.map((d) => d.trim()));
  const out: {
    event: EventItem;
    sessionId: string;
    date: string;
    slot: { id: string; start_time: string; capacity: number };
  }[] = [];
  for (const event of events) {
    for (const session of event.sessions) {
      const date = normalizeSessionDate(session.date || "");
      if (!date || !dateSet.has(date)) continue;
      for (const slot of slotsForSession(session)) {
        out.push({
          event,
          sessionId: session.id,
          date,
          slot,
        });
      }
    }
  }
  return out;
}

/** 스케줄 events + 인력배정 문서를 한 주 달력용으로 합칩니다. */
export function mergeWeekSchedulesWithEvents(
  weekStart: string,
  weekDates: string[],
  events: EventItem[],
  existing: WorkforceSchedule[],
): WorkforceSchedule[] {
  const existingBySource = new Map<string, WorkforceSchedule>();
  for (const s of existing) {
    if (s.sourceEventId && s.sourceSessionId && s.sourceSlotId) {
      existingBySource.set(
        sourceSlotKey(s.sourceEventId, s.sourceSessionId, s.sourceSlotId),
        s,
      );
    }
  }

  const merged: WorkforceSchedule[] = [];
  const usedIds = new Set<string>();
  let colorIdx = 0;

  for (const row of listEventSlotsInWeek(weekDates, events)) {
    const key = sourceSlotKey(row.event.id, row.sessionId, row.slot.id);
    const linked = existingBySource.get(key);
    const color =
      row.event.color?.trim() ||
      linked?.color ||
      WORKFORCE_COLORS[colorIdx % WORKFORCE_COLORS.length];
    colorIdx += 1;

    if (linked) {
      usedIds.add(linked.id);
      merged.push({
        ...linked,
        title: row.event.title || linked.title,
        venue: row.event.venue || linked.venue,
        startTime: row.slot.start_time.trim() || linked.startTime,
        requiredCount:
          row.slot.capacity > 0 ? row.slot.capacity : linked.requiredCount,
        teamIds: normalizeTeamIds(row.event.team_ids),
        note: row.event.notice?.trim() || linked.note,
        color,
        date: row.date,
      });
    } else {
      merged.push({
        id: `virtual:${key}`,
        weekStart,
        date: row.date,
        title: row.event.title,
        startTime: row.slot.start_time.trim() || "10:00",
        venue: row.event.venue,
        requiredCount: Math.max(0, row.slot.capacity || 0),
        teamIds: normalizeTeamIds(row.event.team_ids),
        note: row.event.notice?.trim() || "",
        color,
        assignedUserIds: [],
        status: "draft",
        sourceEventId: row.event.id,
        sourceSessionId: row.sessionId,
        sourceSlotId: row.slot.id,
        createdAt: "",
        updatedAt: "",
        createdBy: "",
      });
    }
  }

  for (const s of existing) {
    if (usedIds.has(s.id)) continue;
    merged.push(s);
  }

  return merged.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
}

/** 해당 주에 있는 events 슬롯 중, 아직 인력배정에 없는 항목만 가져옵니다. */
export async function importEventsForWeek(input: {
  weekStart: string;
  weekDates: string[];
  events: EventItem[];
  existing: WorkforceSchedule[];
}): Promise<{ imported: number; skipped: number }> {
  const uid = await assertAdmin();
  await ensureWeekMeta(input.weekStart, uid);

  const existingKeys = new Set(
    input.existing
      .filter((s) => s.sourceEventId && s.sourceSessionId && s.sourceSlotId)
      .map((s) =>
        sourceSlotKey(s.sourceEventId!, s.sourceSessionId!, s.sourceSlotId!),
      ),
  );

  let imported = 0;
  let skipped = 0;
  let colorIdx = 0;

  for (const row of listEventSlotsInWeek(input.weekDates, input.events)) {
    const key = sourceSlotKey(row.event.id, row.sessionId, row.slot.id);
    if (existingKeys.has(key)) {
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
      startTime: row.slot.start_time.trim() || "10:00",
      venue: row.event.venue,
      requiredCount: Math.max(0, row.slot.capacity || 0),
      teamIds: normalizeTeamIds(row.event.team_ids),
      note: row.event.notice?.trim() || "",
      color,
      sourceEventId: row.event.id,
      sourceSessionId: row.sessionId,
      sourceSlotId: row.slot.id,
    });
    existingKeys.add(key);
    imported += 1;
  }

  if (imported > 0) {
    await writeAssignmentLog({
      weekStart: input.weekStart,
      actorUserId: uid,
      actorName: "",
      action: "import_events",
      detail: `${imported}개 슬롯 가져옴 (중복 ${skipped})`,
    });
  }

  return { imported, skipped };
}

/** 이번 주 스케줄에 아직 없는 이벤트 슬롯 개수 */
export function countPendingEventImports(
  weekDates: string[],
  events: EventItem[],
  existing: WorkforceSchedule[],
): number {
  const existingKeys = new Set(
    existing
      .filter((s) => s.sourceEventId && s.sourceSessionId && s.sourceSlotId)
      .map((s) =>
        sourceSlotKey(s.sourceEventId!, s.sourceSessionId!, s.sourceSlotId!),
      ),
  );
  let n = 0;
  for (const row of listEventSlotsInWeek(weekDates, events)) {
    if (
      !existingKeys.has(
        sourceSlotKey(row.event.id, row.sessionId, row.slot.id),
      )
    ) {
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
    sourceSlotId: schedule.sourceSlotId,
  });
}
