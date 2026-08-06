import type { EventItem, PositionDef, Session, Slot } from "@/types/schedule";

export function updateEventMeta(
  event: EventItem,
  title: string,
  venue: string,
): EventItem {
  return { ...event, title: title.trim(), venue: venue.trim() };
}

export function updateEventDetails(
  event: EventItem,
  details: {
    title: string;
    venue: string;
    notice?: string;
    color?: string;
    usePositions?: boolean;
    positions?: PositionDef[];
  },
): EventItem {
  return {
    ...event,
    title: details.title.trim(),
    venue: details.venue.trim(),
    notice: details.notice?.trim() || undefined,
    color: details.color?.trim() || undefined,
    usePositions: details.usePositions ?? event.usePositions ?? false,
    positions: details.positions ?? event.positions ?? [],
  };
}

export function addSession(event: EventItem, date: string): EventItem {
  const session: Session = {
    id: crypto.randomUUID(),
    date,
    slots: [],
  };
  return { ...event, sessions: [...event.sessions, session] };
}

export function removeSession(event: EventItem, sessionId: string): EventItem {
  return {
    ...event,
    sessions: event.sessions.filter((s) => s.id !== sessionId),
  };
}

export function setSessionDate(
  event: EventItem,
  sessionId: string,
  date: string,
): EventItem {
  const d = date.trim();
  return {
    ...event,
    sessions: event.sessions.map((s) =>
      s.id === sessionId ? { ...s, date: d } : s,
    ),
  };
}

export function addSlot(
  event: EventItem,
  sessionId: string,
  slot: { start_time: string; capacity: number; applied_count: number },
): EventItem {
  const newSlot: Slot = {
    id: crypto.randomUUID(),
    start_time: slot.start_time,
    capacity: slot.capacity,
    applied_count: slot.applied_count,
  };
  return {
    ...event,
    sessions: event.sessions.map((s) =>
      s.id === sessionId ? { ...s, slots: [...s.slots, newSlot] } : s,
    ),
  };
}

export function updateSlot(
  event: EventItem,
  sessionId: string,
  slotId: string,
  patch: Partial<Pick<Slot, "start_time" | "capacity" | "applied_count">>,
): EventItem {
  return {
    ...event,
    sessions: event.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        slots: s.slots.map((sl) =>
          sl.id === slotId ? { ...sl, ...patch } : sl,
        ),
      };
    }),
  };
}

export function removeSlot(
  event: EventItem,
  sessionId: string,
  slotId: string,
): EventItem {
  return {
    ...event,
    sessions: event.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return { ...s, slots: s.slots.filter((sl) => sl.id !== slotId) };
    }),
  };
}
