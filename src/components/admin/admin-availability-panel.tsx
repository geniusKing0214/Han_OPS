"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { subscribeAllAvailability } from "@/lib/firestore-workforce";
import { subscribeAllUsersForAdmin, type ListedUserRow } from "@/lib/firestore-users";
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
    () => new Map(),
  );
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return subscribeAllUsersForAdmin(
      (rows) => {
        setUsers(rows);
        setLoadingUsers(false);
      },
      (e) => setError(e.message),
    );
  }, []);

  useEffect(() => {
    return subscribeAllAvailability(
      (map) => {
        setAvailMap(map);
        setLoadingAvail(false);
      },
      (e) => setError(e.message),
    );
  }, []);

  const members = useMemo(
    () =>
      users
        .filter((u) => (u.accountStatus ?? "approved") === "approved")
        .sort((a, b) =>
          (a.displayName || a.email).localeCompare(b.displayName || b.email, "ko"),
        ),
    [users],
  );

  const { submitted, notSubmitted } = useMemo(() => {
    const submitted: ListedUserRow[] = [];
    const notSubmitted: ListedUserRow[] = [];
    for (const m of members) {
      const avail = resolveAvailability(availMap, m.uid);
      if (avail.memberSubmittedWeeks.includes(weekStart)) {
        submitted.push(m);
      } else {
        notSubmitted.push(m);
      }
    }
    return { submitted, notSubmitted };
  }, [members, availMap, weekStart]);

  const dayBuckets = useMemo(
    () =>
      weekDates.map((date) => {
        const available = submitted.filter((m) =>
          isUserAvailableOnDate(resolveAvailability(availMap, m.uid), date),
        );
        return { date, available };
      }),
    [weekDates, submitted, availMap],
  );

  const loading = loadingUsers || loadingAvail;
  const isNextWeek = weekStart === nextWeekStart;

  return (
    <div className="space-y-6">
      <PageHeader
        title="근무 가능일 현황"
        description="멤버들이 신청한 주간 근무 가능일을 날짜별·인원별로 확인합니다."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-center gap-1 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex min-w-[220px] flex-col items-center">
            <span className="text-sm font-medium tabular-nums">
              {formatWeekRangeLabel(weekStart)}
            </span>
            {isNextWeek ? (
              <span className="text-[10px] text-accent">신청 대상 주 (익주)</span>
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

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">전체 인원</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {members.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">신청 완료</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
              {submitted.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">미신청</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-red-400">
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
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              불러오는 중...
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {dayBuckets.map(({ date, available }) => {
                const { label, dow } = formatDayHeader(date);
                return (
                  <div
                    key={date}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <p className="text-center text-xs font-semibold">
                      {dow}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {label}
                      </span>
                    </p>
                    <p className="mt-1 text-center text-[11px] text-muted-foreground">
                      {available.length}명 가능
                    </p>
                    <div className="mt-2 space-y-1">
                      {available.length === 0 ? (
                        <p className="py-2 text-center text-[11px] text-muted-foreground">
                          없음
                        </p>
                      ) : (
                        available.map((m) => (
                          <p
                            key={m.uid}
                            className="truncate rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300"
                          >
                            {m.displayName?.trim() || m.email}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-400" />
              신청 완료
              <span className="font-normal text-muted-foreground">
                · {submitted.length}명
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                불러오는 중...
              </p>
            ) : submitted.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                신청한 인원이 없습니다.
              </p>
            ) : (
              submitted.map((m) => {
                const avail = resolveAvailability(availMap, m.uid);
                const availableCount = weekDates.filter((d) =>
                  isUserAvailableOnDate(avail, d),
                ).length;
                return (
                  <div
                    key={m.uid}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.displayName?.trim() || m.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TEAM_LABELS[normalizeTeamId(m.team_id)]}
                      </p>
                    </div>
                    <Badge variant="success">{availableCount}/7일</Badge>
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
              미신청
              <span className="font-normal text-muted-foreground">
                · {notSubmitted.length}명
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                불러오는 중...
              </p>
            ) : notSubmitted.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                전원 신청을 완료했습니다.
              </p>
            ) : (
              notSubmitted.map((m) => (
                <div
                  key={m.uid}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.displayName?.trim() || m.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>
                  <Badge variant="destructive">미신청</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
