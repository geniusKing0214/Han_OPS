import { applicantName, datesInMonth } from "@/lib/monthly-sheet-aggregator";
import { filterApplicationsMatchingLiveSchedule } from "@/lib/applications-match-schedule";
import type { ApplicationItem } from "@/types/application";
import type { EventItem, Session } from "@/types/schedule";

export type ApprovalCalendarTimeGroup = {
  time: string;
  names: string[];
};

export type ApprovalCalendarEventEntry = {
  eventId: string;
  eventTitle: string;
  eventColor?: string;
  timeGroups: ApprovalCalendarTimeGroup[];
};

export type ApprovalCalendarDay = {
  date: string;
  entries: ApprovalCalendarEventEntry[];
};

/** 이 세션(날짜)에 해당하는 승인된 신청만 골라낸다 — 그룹/패키지 신청도
 * 포함되도록 (positionSlot이 아닌) 세션 단위로 매칭한다. */
function approvedAppsForSession(
  apps: ApplicationItem[],
  eventId: string,
  session: Session,
): ApplicationItem[] {
  return apps.filter((a) => {
    if (a.eventId !== eventId) return false;
    if (a.status !== "approved" && a.status !== "completed") return false;
    if (a.packageId) return a.packageDates?.includes(session.date) ?? false;
    if (a.groupSessionIds?.length) {
      return a.groupSessionIds.includes(session.id);
    }
    return a.sessionId === session.id;
  });
}

function buildEventEntry(
  event: EventItem,
  session: Session,
  applications: ApplicationItem[],
): ApprovalCalendarEventEntry | null {
  const apps = approvedAppsForSession(applications, event.id, session);
  if (apps.length === 0) return null;

  const namesByTime = new Map<string, string[]>();
  for (const app of apps) {
    const time = app.slotTime?.trim() || "—";
    const list = namesByTime.get(time) ?? [];
    list.push(applicantName(app));
    namesByTime.set(time, list);
  }

  const timeGroups: ApprovalCalendarTimeGroup[] = [...namesByTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, names]) => ({ time, names }));

  return {
    eventId: event.id,
    eventTitle: event.title,
    eventColor: event.color,
    timeGroups,
  };
}

/** 승인 달력: 날짜별로 그 날 세션이 있는 이벤트 중 승인된 신청이
 * 1건 이상 있는 것만, 이벤트명(이벤트 색상) · 시간별 근무자 이름으로 집계 */
export function buildApprovalCalendarDays(input: {
  year: number;
  monthIndex: number;
  events: EventItem[];
  applications: ApplicationItem[];
}): Map<string, ApprovalCalendarDay> {
  const liveApps = filterApplicationsMatchingLiveSchedule(
    input.applications,
    input.events,
  );

  const map = new Map<string, ApprovalCalendarDay>();
  for (const date of datesInMonth(input.year, input.monthIndex)) {
    const entries: ApprovalCalendarEventEntry[] = [];
    for (const event of input.events) {
      for (const session of event.sessions) {
        if (session.date !== date) continue;
        const entry = buildEventEntry(event, session, liveApps);
        if (entry) entries.push(entry);
      }
    }
    entries.sort((a, b) => {
      const aTime = a.timeGroups[0]?.time ?? "";
      const bTime = b.timeGroups[0]?.time ?? "";
      return aTime.localeCompare(bTime);
    });
    map.set(date, { date, entries });
  }
  return map;
}
