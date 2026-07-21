"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { subscribeAllAvailability } from "@/lib/firestore-workforce";
import {
  subscribeAllUsersForAdmin,
  type ListedUserRow,
} from "@/lib/firestore-users";
import { isUserAvailableOnDate, resolveAvailability } from "@/lib/workforce-logic";
import {
  formatDayHeader,
  formatWeekRangeLabel,
  getNextWeekStart,
  getWeekDates,
  shiftWeek,
} from "@/lib/workforce-dates";
import { normalizeTeamId, TEAM_LABELS } from "@/types/team";
import type { WorkforceAvailability } from "@/types/workforce";

export function AdminAvailabilityPanel() {
  const nextWeekStart = useMemo(() => getNextWeekStart(), []);
  const [weekStart, setWeekStart] = useState(nextWeekStart);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const [users, setUsers] = useState<ListedUserRow[]>([]);
  const [availMap, setAvailMap] = useState<Map<string, WorkforceAvailability>>(
    new Map(),
  );
  const [error, setError] = useState("");

  useEffect(
    () =>
      subscribeAllUsersForAdmin(
        (rows) => setUsers(rows),
        (e) => setError(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      subscribeAllAvailability(
        (map) => setAvailMap(map),
        (e) => setError(e.message),
      ),
    [],
  );

  const trackedMembers = useMemo(
    () =>
      users.filter(
        (u) => u.accountStatus === "approved" || u.role === "admin",
      ),
    [users],
  );

  const submitted = useMemo(
    () =>
      trackedMembers.filter((u) => {
        const avail = resolveAvailability(availMap, u.uid);
        return avail.memberSubmittedWeeks.includes(weekStart);
      }),
    [trackedMembers, availMap, weekStart],
  );

  const notSubmitted = useMemo(
    () =>
      trackedMembers.filter((u) => {
        const avail = resolveAvailability(availMap, u.uid);
        return !avail.memberSubmittedWeeks.includes(weekStart);
      }),
    [trackedMembers, availMap, weekStart],
  );

  const dayBuckets = useMemo(
    () =>
      weekDates.map((date) => {
        const members = submitted.filter((u) => {
          const avail = resolveAvailability(availMap, u.uid);
          return isUserAvailableOnDate(avail, date);
        });
        return { date, members };
      }),
    [weekDates, submitted, availMap],
  );

  const isNextWeek = weekStart === nextWeekStart;

  return (
    <div className="space-y-6">
      <PageHeader
        title="근무 가능일 현황"
        description="멤버가 신청한 근무 가능일을 주 단위로 확인합니다."
      />

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-center gap-2 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-center text-sm font-medium tabular-nums">
              {formatWeekRangeLabel(weekStart)}
            </span>
            {isNextWeek ? (
              <Badge variant="accent" className="text-[10px]">
                신청 대상 주 (익주)
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-muted/30">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">전체 인원</p>
            <p className="text-2xl font-semibold tabular-nums">
              {trackedMembers.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">신청 완료</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-400">
              {submitted.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">미신청</p>
            <p className="text-2xl font-semibold tabular-nums text-red-400">
              {notSubmitted.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">일자별 가능 인원</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {dayBuckets.map(({ date, members }) => {
              const { label, dow } = formatDayHeader(date);
              return (
                <div
                  key={date}
                  className="rounded-lg border border-border bg-muted/20 p-2.5"
                >
                  <p className="text-center text-xs font-semibold">
                    {dow}{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {label}
                    </span>
                  </p>
                  <div className="mt-2 space-y-1">
                    {members.length === 0 ? (
                      <p className="py-2 text-center text-[10px] text-muted-foreground">
                        없음
                      </p>
                    ) : (
                      members.map((m) => (
                        <p
                          key={m.uid}
                          className="truncate rounded bg-accent/15 px-1.5 py-1 text-center text-[11px] font-medium text-accent"
                          title={m.displayName || m.email}
                        >
                          {m.displayName || m.email}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-400" />
              신청 완료 ({submitted.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {submitted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                신청한 인원이 없습니다.
              </p>
            ) : (
              submitted.map((u) => {
                const avail = resolveAvailability(availMap, u.uid);
                const availableCount = weekDates.filter((d) =>
                  isUserAvailableOnDate(avail, d),
                ).length;
                return (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {u.displayName || u.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TEAM_LABELS[normalizeTeamId(u.team_id)]}
                      </p>
                    </div>
                    <Badge variant="accent" className="shrink-0">
                      가능 {availableCount}/7일
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="size-4 text-red-400" />
              미신청 ({notSubmitted.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notSubmitted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                전원 신청 완료했습니다.
              </p>
            ) : (
              notSubmitted.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {u.displayName || u.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    미신청
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
