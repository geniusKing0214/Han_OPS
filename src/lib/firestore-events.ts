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
import {
  parseAttendanceSettings,
  serializeAttendanceSettings,
} from "@/lib/attendance-settings";
import { computeTeam2ApplyOpensAt } from "@/lib/application-window";
import { notifyTeamMembersOnScheduleCreated, notifyTeamMembersOnScheduleCancelled } from "@/lib/firestore-notifications";
import { normalizeTeamIds } from "@/types/team";
import type { EventItem, PositionDef, PositionSlot } from "@/types/schedule";

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
  const attendance = parseAttendanceSettings(data.attendance);
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
  return {
    id,
    title,
    venue,
    team_ids: normalizeTeamIds(data.team_ids),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(team2ApplyOpensAt !== undefined ? { team2ApplyOpensAt } : {}),
    ...(notice !== undefined ? { notice } : {}),
    ...(color !== undefined ? { color } : {}),
    attendance,
    sessions: sessions as EventItem["sessions"],
    usePositions,
    positions,
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
    attendance: serializeAttendanceSettings(
      parseAttendanceSettings(event.attendance),
    ),
    usePositions: event.usePositions ?? false,
    positions: event.positions ?? [],
    updatedAt: serverTimestamp(),
  };
  if (event.createdAt) payload.createdAt = event.createdAt;
  if (event.team2ApplyOpensAt) {
    payload.team2ApplyOpensAt = event.team2ApplyOpensAt;
  }
  await setDoc(doc(db, EVENTS_COLLECTION, event.id), payload, { merge: true });
}

/** 이벤트 마감 처리 토글 */
export async function toggleEventClosed(
  eventId: string,
  closed: boolean,
): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), { closed });
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
      attendance: serializeAttendanceSettings(
        parseAttendanceSettings(withMeta.attendance),
      ),
      usePositions: withMeta.usePositions ?? false,
      positions: withMeta.positions ?? [],
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
  }

  const appSnap = await getDocs(
    query(collection(db, APPLICATIONS_COLLECTION), where("eventId", "==", eventId)),
  );
  await Promise.all(appSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
}
