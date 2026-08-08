import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { computeTeam2ApplyOpensAt } from "@/lib/application-window";
import { notifyTeamMembersOnScheduleCreated, notifyTeamMembersOnScheduleCancelled } from "@/lib/firestore-notifications";
import { writeActivityLog } from "@/lib/firestore-activity-log";
import { normalizeTeamIds } from "@/types/team";
import type { EventItem, EventPackage, PositionDef, PositionSlot } from "@/types/schedule";

export const EVENTS_COLLECTION = "events";
const APPLICATIONS_COLLECTION = "applications";

function timestampToIso(value: unknown): string | undefined {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string" && value.trim() !== "") return value;
  return undefined;
}

function isTeam1Only(teamIds: ReturnType<typeof normalizeTeamIds>): boolean {
  return teamIds.length === 1 && teamIds[0] === "team_1";
}

function docToEvent(id: string, data: Record<string, unknown>): EventItem | null {
  const title = data.title;
  const venue = data.venue;
  const sessions = data.sessions;
  if (
    typeof title !== "string" ||
    typeof venue !== "string" ||
    !Array.isArray(sessions)
  ) {
    return null;
  }
  const noticeRaw = typeof data.notice === "string" ? data.notice : undefined;
  const colorRaw = typeof data.color === "string" ? data.color : undefined;
  const notice =
    noticeRaw && noticeRaw.trim() !== "" ? noticeRaw.trim() : undefined;
  const color =
    colorRaw && colorRaw.trim() !== "" ? colorRaw.trim() : undefined;
  const createdAt = timestampToIso(data.createdAt);
  const team2ApplyOpensAt = timestampToIso(data.team2ApplyOpensAt);
  const usePositions = data.usePositions === true;
  const positions: PositionDef[] = Array.isArray(data.positions)
    ? (data.positions as Array<Record<string, unknown>>).map((p) => ({
        id: typeof p.id === "string" ? p.id : "",
        label: typeof p.label === "string" ? p.label : "",
        capacity: typeof p.capacity === "number" ? p.capacity : 0,
        slots: Array.isArray(p.slots)
          ? (p.slots as PositionSlot[])
          : [],
      }))
    : [];
  const closed = data.closed === true ? true : undefined;
  // locked: true=잠금, false=명시 해제(윈도우 우회), undefined=미설정(구형 이벤트)
  const locked = typeof data.locked === "boolean" ? data.locked : undefined;
  const forceApplyOpen = data.forceApplyOpen === true ? true : undefined;
  const packages: EventPackage[] = Array.isArray(data.packages)
    ? (data.packages as Array<Record<string, unknown>>)
        .filter(
          (p) =>
            typeof p.id === "string" &&
            typeof p.label === "string" &&
            typeof p.startDate === "string" &&
            typeof p.endDate === "string",
        )
        .map((p) => ({
          id: p.id as string,
          label: p.label as string,
          startDate: p.startDate as string,
          endDate: p.endDate as string,
        }))
    : [];
  return {
    id,
    title,
    venue,
    team_ids: normalizeTeamIds(data.team_ids),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(team2ApplyOpensAt !== undefined ? { team2ApplyOpensAt } : {}),
    ...(notice !== undefined ? { notice } : {}),
    ...(color !== undefined ? { color } : {}),
    sessions: sessions as EventItem["sessions"],
    usePositions,
    positions,
    ...(closed ? { closed } : {}),
    ...(locked !== undefined ? { locked } : {}),
    ...(forceApplyOpen ? { forceApplyOpen } : {}),
    ...(packages.length > 0 ? { packages } : {}),
  };
}

export function subscribeEvents(
  onNext: (events: EventItem[]) => void,
  onError?: (message: string) => void,
) {
  return onSnapshot(
    collection(db, EVENTS_COLLECTION),
    (snap) => {
      const list: EventItem[] = [];
      for (const d of snap.docs) {
        const ev = docToEvent(d.id, d.data() as Record<string, unknown>);
        if (ev) list.push(ev);
      }
      list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
      onNext(list);
    },
    (err) => onError?.(err.message),
  );
}

export async function createEvent(input: {
  title: string;
  venue: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();
  await setDoc(doc(db, EVENTS_COLLECTION, id), {
    title: input.title.trim(),
    venue: input.venue.trim(),
    team_ids: normalizeTeamIds(["team_1"]),
    sessions: [],
    createdAt: serverTimestamp(),
    team2ApplyOpensAt: computeTeam2ApplyOpensAt(new Date(createdAtIso)),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function saveEvent(event: EventItem): Promise<void> {
  const payload: Record<string, unknown> = {
    title: event.title.trim(),
    venue: event.venue.trim(),
    team_ids: normalizeTeamIds(event.team_ids),
    sessions: event.sessions,
    notice: event.notice?.trim() ?? "",
    color: event.color?.trim() ?? "",
    usePositions: event.usePositions ?? false,
    positions: event.positions ?? [],
    locked: event.locked ?? false,
    packages: event.packages ?? [],
    updatedAt: serverTimestamp(),
  };
  if (event.createdAt) payload.createdAt = event.createdAt;
  if (event.team2ApplyOpensAt) {
    payload.team2ApplyOpensAt = event.team2ApplyOpensAt;
  }
  await setDoc(doc(db, EVENTS_COLLECTION, event.id), payload, { merge: true });
}

/** 이벤트 신청 잠금 토글 */
export async function toggleEventLocked(
  eventId: string,
  locked: boolean,
): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), { locked });
}

/** 이벤트 마감 처리 토글 */
export async function toggleEventClosed(
  eventId: string,
  closed: boolean,
): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), { closed });
}

/** 상시 신청 허용(신청기간 무관 오픈) 토글 */
export async function toggleEventForceApplyOpen(
  eventId: string,
  forceApplyOpen: boolean,
): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), { forceApplyOpen });
}

/** 신규 스케줄 저장 + 해당 팀 멤버 알림 */
export async function createScheduleEvent(
  event: EventItem,
  createdByUserId: string,
): Promise<void> {
  const teamIds = normalizeTeamIds(event.team_ids);
  const now = new Date();
  const createdAtIso = event.createdAt ?? now.toISOString();
  const withMeta: EventItem = {
    ...event,
    team_ids: teamIds,
    createdAt: createdAtIso,
    ...(isTeam1Only(teamIds)
      ? {
          team2ApplyOpensAt:
            event.team2ApplyOpensAt ?? computeTeam2ApplyOpensAt(now),
        }
      : {}),
  };

  await setDoc(
    doc(db, EVENTS_COLLECTION, withMeta.id),
    {
      title: withMeta.title.trim(),
      venue: withMeta.venue.trim(),
      team_ids: teamIds,
      sessions: withMeta.sessions,
      notice: withMeta.notice?.trim() ?? "",
      color: withMeta.color?.trim() ?? "",
      usePositions: withMeta.usePositions ?? false,
      positions: withMeta.positions ?? [],
      locked: withMeta.locked ?? false,
      createdAt: serverTimestamp(),
      ...(isTeam1Only(teamIds)
        ? { team2ApplyOpensAt: withMeta.team2ApplyOpensAt }
        : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await notifyTeamMembersOnScheduleCreated({
      eventId: withMeta.id,
      eventTitle: withMeta.title,
      venue: withMeta.venue,
      teamIds,
      sessions: withMeta.sessions,
      createdByUserId,
    });
  } catch {
    // 알림 실패해도 스케줄 저장은 유지
  }

  try {
    await writeActivityLog({
      action: "schedule_created",
      actorUserId: createdByUserId,
      eventTitle: withMeta.title,
      detail: withMeta.venue,
    });
  } catch {
    // 로그 실패는 스케줄 저장을 막지 않는다.
  }
}

export async function deleteEvent(
  eventId: string,
  options?: {
    event?: EventItem;
    cancelledByUserId?: string;
  },
): Promise<void> {
  if (options?.event && options.cancelledByUserId) {
    try {
      await notifyTeamMembersOnScheduleCancelled({
        eventId: options.event.id,
        eventTitle: options.event.title,
        venue: options.event.venue,
        teamIds: normalizeTeamIds(options.event.team_ids),
        sessions: options.event.sessions,
        createdByUserId: options.cancelledByUserId,
      });
    } catch {
      // 알림 실패해도 삭제는 진행
    }

    try {
      await writeActivityLog({
        action: "schedule_deleted",
        actorUserId: options.cancelledByUserId,
        eventTitle: options.event.title,
        detail: options.event.venue,
      });
    } catch {
      // 로그 실패는 삭제를 막지 않는다.
    }
  }

  const appSnap = await getDocs(
    query(collection(db, APPLICATIONS_COLLECTION), where("eventId", "==", eventId)),
  );
  await Promise.all(appSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
}
