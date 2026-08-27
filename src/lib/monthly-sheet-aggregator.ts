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
import { formatSlotTime, type EventItem, type Session, type Slot } from "@/types/schedule";
import type { WorkforceSchedule } from "@/types/workforce";

export type WorkforceUserSummary = {
  uid: string;
  name: string;
  teamId: TeamId;
};

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

export function applicantName(app: ApplicationItem): string {
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

/** 포지션 기반 이벤트(slots 없음) 전용 행 빌더 */
function buildPositionSessionRow(
  event: EventItem,
  session: Session,
  applications: ApplicationItem[],
  teamId: TeamId,
  includePending: boolean,
  entryOverride?: SheetEntryOverride,
): SheetSlotRow | null {
  // 그룹/패키지 신청 포함 매칭
  const sessionApps = applications.filter(
    (a) =>
      a.eventId === event.id &&
      normalizeAppTeam(a) === teamId &&
      (
        // 패키지 신청: packageDates에 이 날짜가 포함
        (a.packageId && (a.packageDates?.includes(session.date) ?? false)) ||
        // 그룹 신청: groupSessionIds에 이 세션이 포함
        (!a.packageId && (a.groupSessionIds?.includes(session.id) ?? false)) ||
        // 일반 신청: sessionId 일치
        (!a.packageId && a.sessionId === session.id)
      ),
  );

  const visibleApps = sessionApps.filter((a) =>
    statusIncluded(a.status, includePending),
  );
  if (visibleApps.length === 0 && !entryOverride) {
    if (!eventVisibleToTeam(event, teamId)) return null;
    // 일정은 있지만 신청자 없음 — 빈 행 표시
  }

  // 전체 포지션 정원 합산
  const totalCapacity =
    event.positions?.reduce(
      (sum, p) =>
        sum + (p.slots?.reduce((s, sl) => s + (sl.capacity ?? 0), 0) ?? 0),
      0,
    ) ?? 0;

  // 가장 이른 시간 슬롯 시간 (시간 미정 슬롯은 제외하고 계산 — 전부 미정이면 "시간 미정")
  const allSlots = (event.positions ?? []).flatMap((p) => p.slots ?? []);
  const allTimes = allSlots
    .filter((s) => !s.timeUndetermined)
    .map((s) => s.time)
    .filter(Boolean)
    .sort();
  const slotTime =
    allTimes[0] ??
    (allSlots.length > 0 && allSlots.every((s) => s.timeUndetermined)
      ? "시간 미정"
      : "—");

  const applicants = visibleApps.map((a) => ({
    name: applicantName(a),
    status: a.status,
    positionLabel: a.positionLabel,
    groupDates: a.groupDates,
    packageDates: a.packageDates,
    packageLabel: a.packageLabel,
  }));

  const approvedCount = applicants.filter(
    (a) => a.status === "approved" || a.status === "completed",
  ).length;

  // 연속 일정 묶음 정보 계산
  const groupSessions = session.groupId
    ? event.sessions
        .filter((s) => s.groupId === session.groupId)
        .sort((a, b) => a.date.localeCompare(b.date))
    : null;
  const isGroup = !!groupSessions && groupSessions.length > 1;

  const entryKey = `pos:${event.id}:${session.id}:${teamId}`;
  const base = {
    entryKey,
    eventId: event.id,
    sessionId: session.id,
    slotId: "",
    date: session.date,
    ...(isGroup
      ? {
          groupId: session.groupId!,
          groupDates: groupSessions.map((s) => s.date),
          groupSessionIds: groupSessions.map((s) => s.id),
        }
      : {}),
    teamId,
    eventTitle: event.title,
    venue: event.venue,
    slotTime,
    capacity: totalCapacity,
    headcount: approvedCount || applicants.length,
    applicants,
    eventNotice: event.notice,
    eventColor: event.color,
  };

  return applyEntryOverride(base, entryOverride);
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
  // 그룹 신청(slotId 없음)도 이 세션에 표시되도록 매칭
  const slotApps = [
    ...applicationsForSlot(applications, event.id, session.id, slot.id),
    ...applications.filter(
      (a) =>
        a.eventId === event.id &&
        !a.slotId &&
        (a.groupSessionIds?.includes(session.id) ?? false),
    ),
  ].filter((a) => normalizeAppTeam(a) === teamId);

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
    positionLabel: a.positionLabel,
    groupDates: a.groupDates,
    packageDates: a.packageDates,
    packageLabel: a.packageLabel,
  }));

  const approvedCount = applicants.filter(
    (a) => a.status === "approved" || a.status === "completed",
  ).length;

  // 연속 일정 묶음 정보 계산
  const groupSessions = session.groupId
    ? event.sessions
        .filter((s) => s.groupId === session.groupId)
        .sort((a, b) => a.date.localeCompare(b.date))
    : null;
  const isGroup = !!groupSessions && groupSessions.length > 1;

  const base = {
    entryKey: slotKey(event.id, session.id, slot.id),
    eventId: event.id,
    sessionId: session.id,
    slotId: slot.id,
    date: session.date,
    ...(isGroup
      ? {
          groupId: session.groupId!,
          groupDates: groupSessions.map((s) => s.date),
          groupSessionIds: groupSessions.map((s) => s.id),
        }
      : {}),
    teamId,
    eventTitle: event.title,
    venue: event.venue,
    slotTime: formatSlotTime(slot.start_time, slot.timeUndetermined),
    capacity: slot.capacity,
    // slot.applied_count는 팀 구분 없이 전체 합산된 값이라 팀별 화면에 쓰면
    // 상대 팀 인원이 새어 보일 수 있어 폴백에서 제외 (approvedCount/applicants는
    // 이미 이 함수 상단에서 teamId로 필터링된 값이라 안전하다).
    headcount: approvedCount || applicants.length,
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

function buildWorkforceRow(
  schedule: WorkforceSchedule,
  teamId: TeamId,
  usersById: ReadonlyMap<string, WorkforceUserSummary>,
  applications: ApplicationItem[],
  entryOverride?: SheetEntryOverride,
): SheetSlotRow | null {
  const assignedUsers = schedule.assignedUserIds
    .map((uid) => usersById.get(uid))
    .filter(
      (user): user is WorkforceUserSummary =>
        Boolean(user) && user?.teamId === teamId,
    );
  const assignedCount = schedule.assignedUserIds.filter((uid) => {
    const user = usersById.get(uid);
    // 멤버 화면처럼 사용자 명단을 읽을 수 없을 때는 팀 공용 일정의
    // 전체 배정 인원을 숫자로라도 표시한다.
    return user ? user.teamId === teamId : schedule.teamIds.includes(teamId);
  }).length;

  // 스케줄러에 아직 배정으로 옮기지 않은, 원래 신청서로 승인된 인원도
  // 합쳐서 보여준다 — 그렇지 않으면 스케줄러에서 처음 배정하는 순간
  // 이 행이 신청서 기반 행을 대체하면서 기존 승인 인원이 화면에서
  // 사라져 보인다 (인력 배치 스케줄러 화면은 이미 이렇게 합산해서 보여줌).
  const assignedUidSet = new Set(schedule.assignedUserIds);
  const seenApplicantKeys = new Set<string>();
  const unassignedApprovedApplicants =
    schedule.sourceEventId && schedule.sourceSessionId
      ? applications.filter((a) => {
          if (a.status !== "approved" && a.status !== "completed") return false;
          if (a.eventId !== schedule.sourceEventId) return false;
          if (a.sessionId !== schedule.sourceSessionId) return false;
          if (normalizeAppTeam(a) !== teamId) return false;
          if (a.userId && assignedUidSet.has(a.userId)) return false;
          const dedupeKey = a.userId || applicantName(a);
          if (seenApplicantKeys.has(dedupeKey)) return false;
          seenApplicantKeys.add(dedupeKey);
          return true;
        })
      : [];

  const totalCount = assignedCount + unassignedApprovedApplicants.length;
  if (totalCount === 0 && !entryOverride) return null;

  const applicants = [
    ...assignedUsers.map((user) => ({
      name: user.name,
      status: "approved" as const,
      positionLabel: schedule.assigneePositions?.[user.uid],
    })),
    ...unassignedApprovedApplicants.map((a) => ({
      name: applicantName(a),
      status: "approved" as const,
      positionLabel: a.positionLabel,
    })),
  ];
  const base = {
    entryKey: `workforce:${schedule.id}:${teamId}`,
    workforceScheduleId: schedule.id,
    eventId: schedule.sourceEventId ?? "",
    sessionId: schedule.sourceSessionId ?? "",
    slotId: schedule.sourceSlotId ?? "",
    date: schedule.date,
    teamId,
    eventTitle: schedule.title,
    venue: schedule.venue,
    slotTime: schedule.startTime.trim() || "—",
    capacity: schedule.requiredCount,
    headcount: totalCount,
    applicants,
    eventNotice: schedule.note || undefined,
    eventColor: schedule.color,
  };
  const row = applyEntryOverride(base, entryOverride);
  return {
    ...row,
    statusLabel: `배정 ${totalCount}명 · 필요 ${schedule.requiredCount}명`,
    displayLines: [
      row.eventTitle,
      row.venue,
      applicants.length > 0
        ? applicants.map((applicant) => applicant.name).join(", ")
        : `배정 ${totalCount}명`,
      `${row.slotTime} · ${totalCount}/${schedule.requiredCount}명`,
    ],
  };
}

function buildDayBundle(
  date: string,
  events: EventItem[],
  applications: ApplicationItem[],
  workforceSchedules: WorkforceSchedule[],
  workforceUsersById: ReadonlyMap<string, WorkforceUserSummary>,
  teamFilter: TeamFilterValue,
  includePending: boolean,
  dayOverride?: SheetDayOverride,
): SheetDayBundle {
  const rows: SheetSlotRow[] = [];
  const teams = teamsForFilter(teamFilter);

  for (const teamId of teams) {
    const dayWorkforceSchedules = workforceSchedules.filter(
      (schedule) =>
        schedule.date === date &&
        schedule.status !== "cancelled" &&
        schedule.teamIds.includes(teamId) &&
        schedule.assignedUserIds.length > 0,
    );
    const linkedSessionKeys = new Set(
      dayWorkforceSchedules
        .filter(
          (schedule) => schedule.sourceEventId && schedule.sourceSessionId,
        )
        .map(
          (schedule) =>
            `${schedule.sourceEventId}:${schedule.sourceSessionId}`,
        ),
    );

    for (const event of events) {
      if (!eventVisibleToTeam(event, teamId)) continue;
      for (const session of event.sessions) {
        if (session.date !== date) continue;
        // 스케줄러에 연결되어 실제 배정이 있으면 슬롯 신청 행 대신
        // 아래의 인력 배정 행 하나로 표시하여 중복을 방지한다.
        if (linkedSessionKeys.has(`${event.id}:${session.id}`)) continue;
        // 포지션 기반 이벤트: slots가 비어 있으면 전체 신청을 하나의 행으로
        if (session.slots.length === 0) {
          const posEntryKey = `pos:${event.id}:${session.id}:${teamId}`;
          const posEntryOverride = dayOverride?.entryOverrides?.[posEntryKey];
          const row = buildPositionSessionRow(
            event,
            session,
            applications,
            teamId,
            includePending,
            posEntryOverride,
          );
          if (row) {
            rows.push(
              teamFilter === "all"
                ? { ...row, displayLines: [`[${TEAM_LABELS[teamId]}]`, ...row.displayLines] }
                : row,
            );
          }
          continue;
        }
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

    for (const schedule of dayWorkforceSchedules) {
      const entryKey = `workforce:${schedule.id}:${teamId}`;
      const entryOverride = dayOverride?.entryOverrides?.[entryKey];
      const row = buildWorkforceRow(
        schedule,
        teamId,
        workforceUsersById,
        applications,
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
  workforceSchedules?: WorkforceSchedule[];
  workforceUsers?: WorkforceUserSummary[];
  teamFilter: TeamFilterValue;
  includePending: boolean;
  dayOverridesByTeam: Partial<Record<TeamId, Record<string, SheetDayOverride>>>;
}): Map<string, SheetDayBundle> {
  const liveApps = filterApplicationsMatchingLiveSchedule(
    input.applications,
    input.events,
  );
  const workforceUsersById = new Map(
    (input.workforceUsers ?? []).map((user) => [user.uid, user]),
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
        input.workforceSchedules ?? [],
        workforceUsersById,
        input.teamFilter,
        input.includePending,
        mergedOverride,
      ),
    );
  }
  return map;
}
