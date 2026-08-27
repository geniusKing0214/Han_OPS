import type { ApplicationItem, ApplicationStatus } from "@/types/application";
import { formatSlotTime, type EventItem, type Session, type Slot } from "@/types/schedule";

export type SlotStatusCounts = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  completed: number;
};

export function countApplicationsByStatus(
  apps: ApplicationItem[],
): SlotStatusCounts {
  const counts: SlotStatusCounts = {
    total: apps.length,
    approved: 0,
    pending: 0,
    rejected: 0,
    completed: 0,
  };
  for (const a of apps) {
    if (a.status === "approved") counts.approved += 1;
    else if (a.status === "pending") counts.pending += 1;
    else if (a.status === "rejected") counts.rejected += 1;
    else if (a.status === "completed") counts.completed += 1;
  }
  return counts;
}

export function applicationsForSlot(
  apps: ApplicationItem[],
  eventId: string,
  sessionId: string,
  slotId: string,
): ApplicationItem[] {
  return apps
    .filter(
      (a) =>
        a.eventId === eventId &&
        a.sessionId === sessionId &&
        a.slotId === slotId,
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** 포지션 기반 이벤트 — 특정 positionId 신청자 목록 */
export function applicationsForPosition(
  apps: ApplicationItem[],
  eventId: string,
  positionId: string,
): ApplicationItem[] {
  return apps
    .filter((a) => a.eventId === eventId && a.positionId === positionId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** 포지션 기반 이벤트 — 이벤트 전체 신청자 (포지션 미지정 포함) */
export function allApplicationsForEvent(
  apps: ApplicationItem[],
  eventId: string,
): ApplicationItem[] {
  return apps
    .filter((a) => a.eventId === eventId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function eventsWithSessionsOnDate(
  events: EventItem[],
  date: string,
): { event: EventItem; sessions: Session[] }[] {
  return events
    .map((event) => ({
      event,
      sessions: event.sessions.filter((s) => s.date === date),
    }))
    .filter((row) => row.sessions.length > 0)
    .sort((a, b) => a.event.title.localeCompare(b.event.title, "ko"));
}

export function slotKey(eventId: string, sessionId: string, slotId: string) {
  return `${eventId}:${sessionId}:${slotId}`;
}

export function formatSlotTimeLabel(slot: Slot): string {
  return formatSlotTime(slot.start_time, slot.timeUndetermined);
}

export function statusBadgeVariant(
  status: ApplicationStatus,
): "success" | "warning" | "destructive" | "default" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "destructive";
  return "default";
}

export function formatSubmittedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso.replace("T", " ").slice(0, 16);
  }
}
