import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeTeamIds } from "@/types/team";
import type { EventItem } from "@/types/schedule";

export const EVENTS_COLLECTION = "events";
const APPLICATIONS_COLLECTION = "applications";

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
  return {
    id,
    title,
    venue,
    team_ids: normalizeTeamIds(data.team_ids),
    ...(notice !== undefined ? { notice } : {}),
    ...(color !== undefined ? { color } : {}),
    sessions: sessions as EventItem["sessions"],
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
  await setDoc(doc(db, EVENTS_COLLECTION, id), {
    title: input.title.trim(),
    venue: input.venue.trim(),
    team_ids: normalizeTeamIds(["team_1"]),
    sessions: [],
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function saveEvent(event: EventItem): Promise<void> {
  await setDoc(
    doc(db, EVENTS_COLLECTION, event.id),
    {
      title: event.title.trim(),
      venue: event.venue.trim(),
      team_ids: normalizeTeamIds(event.team_ids),
      sessions: event.sessions,
      notice: event.notice?.trim() ?? "",
      color: event.color?.trim() ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteEvent(eventId: string): Promise<void> {
  const appSnap = await getDocs(
    query(collection(db, APPLICATIONS_COLLECTION), where("eventId", "==", eventId)),
  );
  await Promise.all(appSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
}
