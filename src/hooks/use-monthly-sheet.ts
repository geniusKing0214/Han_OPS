"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildMonthlySheetDays,
  datesInMonth,
  type WorkforceUserSummary,
} from "@/lib/monthly-sheet-aggregator";
import {
  subscribeApplicationsInMonthForAdmin,
  subscribeApplicationsInMonthForTeam,
} from "@/lib/firestore-applications";
import { subscribeMonthlySheet } from "@/lib/firestore-monthly-sheets";
import { subscribeWorkforceSchedulesMulti } from "@/lib/firestore-workforce";
import { subscribeAllUsersForAdmin } from "@/lib/firestore-users";
import { getWeekStartMonday } from "@/lib/workforce-dates";
import { filterEventsByTeamFilter, filterEventsForMember } from "@/lib/team-utils";
import type { ApplicationItem } from "@/types/application";
import type { MonthlySheetDoc } from "@/types/monthly-sheet";
import { monthKeyFromDate } from "@/types/monthly-sheet";
import {
  DEFAULT_TEAM_ID,
  TEAM_IDS,
  normalizeTeamId,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";
import type { EventItem } from "@/types/schedule";
import type { WorkforceSchedule } from "@/types/workforce";

export function useMonthlySheetData(input: {
  month: Date;
  teamFilter: TeamFilterValue;
  includePending: boolean;
  isAdmin: boolean;
  memberTeamId?: TeamId;
  events: EventItem[];
}) {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [workforceSchedules, setWorkforceSchedules] = useState<
    WorkforceSchedule[]
  >([]);
  const [workforceUsers, setWorkforceUsers] = useState<
    WorkforceUserSummary[]
  >([]);
  const [workforceLoading, setWorkforceLoading] = useState(input.isAdmin);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [sheetDocs, setSheetDocs] = useState<
    Partial<Record<TeamId, MonthlySheetDoc | null>>
  >({});

  const monthKey = monthKeyFromDate(input.month);
  const year = input.month.getFullYear();
  const monthIndex = input.month.getMonth();
  const memberTeam = normalizeTeamId(input.memberTeamId);

  const monthWeekStarts = useMemo(
    () => [
      ...new Set(
        datesInMonth(year, monthIndex).map((date) =>
          getWeekStartMonday(new Date(`${date}T00:00:00`)),
        ),
      ),
    ],
    [year, monthIndex],
  );

  useEffect(() => {
    if (!input.isAdmin) {
      setWorkforceSchedules([]);
      setWorkforceUsers([]);
      setWorkforceLoading(false);
      return;
    }

    setWorkforceLoading(true);
    let schedulesReady = false;
    let usersReady = false;
    const finishIfReady = () => {
      if (schedulesReady && usersReady) setWorkforceLoading(false);
    };
    const unsubscribeSchedules = subscribeWorkforceSchedulesMulti(
      monthWeekStarts,
      (rows) => {
        setWorkforceSchedules(
          rows.filter((row) => row.date.startsWith(monthKey)),
        );
        schedulesReady = true;
        finishIfReady();
      },
      (err) => {
        setAppsError(err.message);
        schedulesReady = true;
        finishIfReady();
      },
    );
    const unsubscribeUsers = subscribeAllUsersForAdmin(
      (rows) => {
        setWorkforceUsers(
          rows.map((row) => ({
            uid: row.uid,
            name: row.displayName?.trim() || row.email,
            teamId: normalizeTeamId(row.team_id),
          })),
        );
        usersReady = true;
        finishIfReady();
      },
      (err) => {
        setAppsError(err.message);
        usersReady = true;
        finishIfReady();
      },
    );
    return () => {
      unsubscribeSchedules();
      unsubscribeUsers();
    };
  }, [input.isAdmin, monthKey, monthWeekStarts]);

  useEffect(() => {
    setAppsLoading(true);
    setAppsError(null);

    if (input.isAdmin) {
      const unsub = subscribeApplicationsInMonthForAdmin(
        monthKey,
        (items) => {
          setApplications(items);
          setAppsLoading(false);
        },
        (err) => {
          setAppsError(err.message);
          setAppsLoading(false);
        },
      );
      return unsub;
    }

    const unsub = subscribeApplicationsInMonthForTeam(
      memberTeam,
      monthKey,
      (items) => {
        setApplications(items);
        setAppsLoading(false);
      },
      (err) => {
        setAppsError(err.message);
        setAppsLoading(false);
      },
    );
    return unsub;
  }, [input.isAdmin, memberTeam, monthKey]);

  const teamsToSubscribe: TeamId[] = useMemo(
    () => (input.teamFilter === "all" ? [...TEAM_IDS] : [input.teamFilter]),
    [input.teamFilter],
  );

  useEffect(() => {
    const unsubs = teamsToSubscribe.map((teamId) =>
      subscribeMonthlySheet(
        year,
        monthIndex + 1,
        teamId,
        (doc) => {
          setSheetDocs((prev) => ({ ...prev, [teamId]: doc }));
        },
        () => {
          setSheetDocs((prev) => ({ ...prev, [teamId]: null }));
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [year, monthIndex, teamsToSubscribe]);

  const filteredEvents = useMemo(() => {
    if (input.isAdmin) {
      return filterEventsByTeamFilter(input.events, input.teamFilter);
    }
    return filterEventsForMember(input.events, memberTeam);
  }, [input.events, input.isAdmin, input.teamFilter, memberTeam]);

  const dayOverridesByTeam = useMemo(() => {
    const map: Partial<
      Record<TeamId, Record<string, NonNullable<MonthlySheetDoc["dayOverrides"]>[string]>>
    > = {};
    for (const teamId of TEAM_IDS) {
      const doc = sheetDocs[teamId];
      if (doc?.dayOverrides) map[teamId] = doc.dayOverrides;
    }
    return map;
  }, [sheetDocs]);

  const effectiveTeamFilter: TeamFilterValue = input.isAdmin
    ? input.teamFilter
    : memberTeam;

  const days = useMemo(
    () =>
      buildMonthlySheetDays({
        year,
        monthIndex,
        events: filteredEvents,
        applications,
        workforceSchedules,
        workforceUsers,
        teamFilter: effectiveTeamFilter,
        includePending: input.isAdmin && input.includePending,
        dayOverridesByTeam,
      }),
    [
      year,
      monthIndex,
      filteredEvents,
      applications,
      workforceSchedules,
      workforceUsers,
      effectiveTeamFilter,
      input.isAdmin,
      input.includePending,
      dayOverridesByTeam,
    ],
  );

  const adminMemo =
    input.teamFilter !== "all"
      ? sheetDocs[input.teamFilter]?.adminMemo
      : undefined;

  return {
    days,
    applications,
    appsLoading: appsLoading || workforceLoading,
    appsError,
    sheetDocs,
    adminMemo,
    effectiveTeamFilter,
    memberTeam: memberTeam || DEFAULT_TEAM_ID,
  };
}
