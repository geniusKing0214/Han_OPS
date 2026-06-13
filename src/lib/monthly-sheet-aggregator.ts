import {
  applicationsForSlot,
  slotKey,
} from "@/lib/admin-application-roster";
import { filterApplicationsMatchingLiveSchedule } from "@/lib/applications-match-schedule";
import { eventVisibleToTeam } from "@/lib/team-utils";
import type { ApplicationItem } from "@/types/application";
import type {
  SheetDayBundle,
  SheetDayOverride,
  SheetEntryOverride,
  SheetSlotRow,
} from "@/types/monthly-sheet";
import {
  TEAM_IDS,
  TEAM_LABELS,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";
import type { EventItem, Session, Slot } from "@/types/schedule";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function datesInMonth(year: number, monthIndex: number): string[] {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const month = monthIndex + 1;
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(`${year}-${pad2(month)}-${pad2(d)}`);
  }
  return out;
}

function applicantName(app: ApplicationItem): string {
  const name = app.applicantDisplayName?.trim();
  if (name) return name;
  const email = app.applicantEmail?.trim();
  if (email) return email.split("@")[0] ?? "—";
  return "—";
}

function statusIncluded(
  status: ApplicationItem["status"],
  includePending: boolean,
): boolean {
  if (status === "approved" || status === "completed") return true;
  if (includePending && status === "pending") return true;
  return false;
}

function formatStatusLabel(
  approved: number,
  pending: number,
  includePending: boolean,
): string {
  const parts: string[] = [];
  if (approved > 0) parts.push(`승인 ${approved}명`);
  if (includePending && pending > 0) parts.push(`대기 ${pending}명`);
  return parts.join(" · ") || "—";
}

function applyEntryOverride(
  base: Omit<SheetSlotRow, "override" | "displayLines" | "statusLabel">,
  override?: SheetEntryOverride,
): SheetSlotRow {
  const eventTitle = override?.eventTitle?.trim() || base.eventTitle;
  const venue = override?.venue?.trim() || base.venue;
  const slotTime = override?.slotTime?.trim() || base.slotTime;
  const headcount =
    typeof override?.headcount === "number"
      ? override.headcount
      : base.headcount;
  const color = override?.color?.trim() || base.eventColor;

  const approvedNames = base.applicants
    .filter((a) => a.status === "approved" || a.status === "completed")
    .map((a) => a.name);
  const pendingNames = base.applicants
    .filter((a) => a.status === "pending")
    .map((a) => a.name);

  const displayLines: string[] = [];
  if (eventTitle) displayLines.push(eventTitle);
  if (venue) displayLines.push(venue);
  if (approvedNames.length > 0) {
    displayLines.push(approvedNames.join(" / "));
  } else if (pendingNames.length > 0) {
    displayLines.push(`${pendingNames.join(" / ")} (대기)`);
  }
  const timeLine = `${slotTime} · 인원 ${headcount}명`;
  displayLines.push(timeLine);
  if (override?.displayMemo?.trim()) {
    displayLines.push(override.displayMemo.trim());
  }
  if (override?.extraMemo?.trim()) {
    displayLines.push(override.extraMemo.trim());
  }

  const approved = base.applicants.filter(
    (a) => a.status === "approved" || a.status === "completed",
  ).length;
  const pending = base.applicants.filter((a) => a.status === "pending").length;

  return {
    ...base,
    eventTitle,
    venue,
    slotTime,
    headcount,
    eventColor: color,
    override,
    displayLines,
    statusLabel: formatStatusLabel(approved, pending, true),
  };
}

function buildSlotRow(
  event: EventItem,
  session: Session,
  slot: Slot,
  applications: ApplicationItem[],
  teamId: TeamId,
  includePending: boolean,
  entryOverride?: SheetEntryOverride,
): SheetSlotRow | null {
  const slotApps = applicationsForSlot(
    applications,
    event.id,
    session.id,
    slot.id,
  ).filter((a) => normalizeAppTeam(a) === teamId);

  const visibleApps = slotApps.filter((a) =>
    statusIncluded(a.status, includePending),
  );
  if (visibleApps.length === 0 && !entryOverride) {
    const hasSchedule = eventVisibleToTeam(event, teamId);
    if (!hasSchedule) return null;
    // 일정만 있고 신청자 없음 — 빈 슬롯도 표시
  }

  const applicants = visibleApps.map((a) => ({
    name: applicantName(a),
    status: a.status,
  }));

  const approvedCount = applicants.filter(
    (a) => a.status === "approved" || a.status === "completed",
  ).length;

  const base = {
    entryKey: slotKey(event.id, session.id, slot.id),
    eventId: event.id,
    sessionId: session.id,
    slotId: slot.id,
    date: session.date,
    teamId,
    eventTitle: event.title,
    venue: event.venue,
    slotTime: slot.start_time.trim() || "—",
    capacity: slot.capacity,
    headcount: approvedCount || slot.applied_count || applicants.length,
    applicants,
    eventNotice: event.notice,
    eventColor: event.color,
  };

  return applyEntryOverride(base, entryOverride);
}

function normalizeAppTeam(app: ApplicationItem): TeamId {
  return app.team_id === "team_2" ? "team_2" : "team_1";
}

function teamsForFilter(filter: TeamFilterValue): TeamId[] {
  if (filter === "all") return [...TEAM_IDS];
  return [filter];
}

function buildDayBundle(
  date: string,
  events: EventItem[],
  applications: ApplicationItem[],
  teamFilter: TeamFilterValue,
  includePending: boolean,
  dayOverride?: SheetDayOverride,
): SheetDayBundle {
  const rows: SheetSlotRow[] = [];
  const teams = teamsForFilter(teamFilter);

  for (const teamId of teams) {
    for (const event of events) {
      if (!eventVisibleToTeam(event, teamId)) continue;
      for (const session of event.sessions) {
        if (session.date !== date) continue;
        for (const slot of session.slots) {
          const entryOverride = dayOverride?.entryOverrides?.[
            slotKey(event.id, session.id, slot.id)
          ];
          const row = buildSlotRow(
            event,
            session,
            slot,
            applications,
            teamId,
            includePending,
            entryOverride,
          );
          if (!row) continue;
          if (teamFilter === "all") {
            rows.push({
              ...row,
              displayLines: [
                `[${TEAM_LABELS[teamId]}]`,
                ...row.displayLines,
              ],
            });
          } else {
            rows.push(row);
          }
        }
      }
    }
  }

  rows.sort((a, b) => {
    const teamCmp = a.teamId.localeCompare(b.teamId);
    if (teamCmp !== 0) return teamCmp;
    return a.slotTime.localeCompare(b.slotTime);
  });

  const markerColors = rows
    .map((r) => r.override?.color || r.eventColor || dayOverride?.color)
    .filter((c): c is string => Boolean(c?.trim()));

  const cellPreviewLines: string[] = [];
  if (dayOverride?.manualText?.trim()) {
    cellPreviewLines.push(dayOverride.manualText.trim());
  }
  if (dayOverride?.customMemo?.trim()) {
    cellPreviewLines.push(dayOverride.customMemo.trim());
  }
  for (const row of rows.slice(0, 3)) {
    cellPreviewLines.push(...row.displayLines.slice(0, 3));
  }
  if (rows.length > 3) {
    cellPreviewLines.push(`+${rows.length - 3}건 더`);
  }

  return {
    date,
    rows,
    dayOverride,
    markerColors: [...new Set(markerColors)],
    cellPreviewLines,
  };
}

export function buildMonthlySheetDays(input: {
  year: number;
  monthIndex: number;
  events: EventItem[];
  applications: ApplicationItem[];
  teamFilter: TeamFilterValue;
  includePending: boolean;
  dayOverridesByTeam: Partial<Record<TeamId, Record<string, SheetDayOverride>>>;
}): Map<string, SheetDayBundle> {
  const liveApps = filterApplicationsMatchingLiveSchedule(
    input.applications,
    input.events,
  );

  const map = new Map<string, SheetDayBundle>();
  for (const date of datesInMonth(input.year, input.monthIndex)) {
    let mergedOverride: SheetDayOverride | undefined;

    if (input.teamFilter === "all") {
      mergedOverride = undefined;
    } else {
      mergedOverride = input.dayOverridesByTeam[input.teamFilter]?.[date];
    }

    map.set(
      date,
      buildDayBundle(
        date,
        input.events,
        liveApps,
        input.teamFilter,
        input.includePending,
        mergedOverride,
      ),
    );
  }
  return map;
}
