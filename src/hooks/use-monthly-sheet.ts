"use client";

import { useEffect, useMemo, useState } from "react";

import { buildMonthlySheetDays } from "@/lib/monthly-sheet-aggregator";
import {
  subscribeApplicationsInMonthForAdmin,
  subscribeApplicationsInMonthForTeam,
} from "@/lib/firestore-applications";
import { subscribeMonthlySheet } from "@/lib/firestore-monthly-sheets";
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

export function useMonthlySheetData(input: {
  month: Date;
  teamFilter: TeamFilterValue;
  includePending: boolean;
  isAdmin: boolean;
  memberTeamId?: TeamId;
  events: EventItem[];
}) {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [sheetDocs, setSheetDocs] = useState<
    Partial<Record<TeamId, MonthlySheetDoc | null>>
  >({});

  const monthKey = monthKeyFromDate(input.month);
  const year = input.month.getFullYear();
  const monthIndex = input.month.getMonth();
  const memberTeam = normalizeTeamId(input.memberTeamId);

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
        teamFilter: effectiveTeamFilter,
        includePending: input.isAdmin && input.includePending,
        dayOverridesByTeam,
      }),
    [
      year,
      monthIndex,
      filteredEvents,
      applications,
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
    appsLoading,
    appsError,
    sheetDocs,
    adminMemo,
    effectiveTeamFilter,
    memberTeam: memberTeam || DEFAULT_TEAM_ID,
  };
}
