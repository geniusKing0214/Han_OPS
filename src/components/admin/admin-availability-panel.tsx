"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { normalizeTeamId, TEAM_LABELS } from "@/types/team";
import type { WorkforceAvailability } from "@/types/workforce";

/** 표시 중인 주 안에서 사유 메모가 달린 불가 날짜 목록 */
function unavailableReasonsFor(
  avail: WorkforceAvailability,
  dates: string[],
): { date: string; note: string }[] {
  return dates
    .filter((d) => !isUserAvailableOnDate(avail, d) && avail.dateExceptionNotes[d])
    .map((d) => ({ date: d, note: avail.dateExceptionNotes[d]! }));
}

export function AdminAvailabilityPanel() {
  const nextWeekStart = useMemo(() => getNextWeekStart(), []);
  const [weekStart, setWeekStart] = useState(nextWeekStart);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const [reasonMember, setReasonMember] = useState<ListedUserRow | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [notSubmittedOpen, setNotSubmittedOpen] = useState(false);

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
        const available: ListedUserRow[] = [];
        const unavailable: ListedUserRow[] = [];
        for (const u of submitted) {
          const avail = resolveAvailability(availMap, u.uid);
          if (isUserAvailableOnDate(avail, date)) available.push(u);
          else unavailable.push(u);
        }
        return { date, available, unavailable };
      }),
    [weekDates, submitted, availMap],
  );

  useEffect(() => {
    setExpandedDate(null);
  }, [weekStart]);

  const isNextWeek = weekStart === nextWeekStart;
  const expandedBucket = dayBuckets.find((b) => b.date === expandedDate) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="근무 가능일 현황"
        description="멤버가 신청한 근무 가능일을 주 단위로 확인합니다."
      />

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
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
            <p className="text-2xl font-semibold tabular-nums text-emerald-600">
              {submitted.length}
            </p>
          </CardContent>
        </Card>
        <button
          type="button"
          onClick={() => setNotSubmittedOpen((v) => !v)}
          className={cn(
            "rounded-xl border text-left transition-colors",
            notSubmittedOpen
              ? "border-red-500/40 bg-red-500/10"
              : "border-border bg-muted/30 hover:border-red-500/30",
          )}
        >
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">미신청</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums text-red-600">
                {notSubmitted.length}
              </p>
              {notSubmittedOpen ? (
                <ChevronUp className="size-4 text-red-600" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              클릭해서 미신청자 보기
            </p>
          </CardContent>
        </button>
      </div>

      {/* 미신청자 리스트 */}
      {notSubmittedOpen && notSubmitted.length > 0 ? (
        <Card className="border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600">
              미신청자 목록 ({notSubmitted.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {notSubmitted.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.displayName || u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TEAM_LABELS[normalizeTeamId(u.team_id)]}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    미신청
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : notSubmittedOpen && notSubmitted.length === 0 ? (
        <Card className="border-emerald-500/20">
          <CardContent className="py-6 text-center text-sm text-emerald-600">
            모든 멤버가 신청을 완료했습니다 🎉
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">일자별 가능 인원</CardTitle>
          <p className="text-xs text-muted-foreground">
            요일을 누르면 근무 가능·불가능 인원을 펼쳐볼 수 있습니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {dayBuckets.map(({ date, available, unavailable }) => {
              const { label, dow } = formatDayHeader(date);
              const isOpen = expandedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() =>
                    setExpandedDate((prev) => (prev === date ? null : date))
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors",
                    isOpen
                      ? "border-accent bg-accent/10"
                      : "border-border bg-muted/20 hover:border-accent/40",
                  )}
                >
                  <p className="text-xs font-semibold">
                    {dow}{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {label}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    가능 <span className="font-medium text-accent">{available.length}</span>
                    {" · "}
                    불가 <span className="font-medium text-red-700">{unavailable.length}</span>
                  </p>
                  {isOpen ? (
                    <ChevronUp className="size-3.5 text-accent" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {expandedBucket ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {(() => {
                const { label, dow } = formatDayHeader(expandedBucket.date);
                return `${dow}요일 · ${label} 상세`;
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-accent">
                  근무 가능 ({expandedBucket.available.length})
                </p>
                {expandedBucket.available.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    가능한 인원이 없습니다.
                  </p>
                ) : (
                  expandedBucket.available.map((u) => (
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
                        가능
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700">
                  근무 불가능 ({expandedBucket.unavailable.length})
                </p>
                {expandedBucket.unavailable.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    불가능한 인원이 없습니다.
                  </p>
                ) : (
                  expandedBucket.unavailable.map((u) => {
                    const avail = resolveAvailability(availMap, u.uid);
                    const hasReason = unavailableReasonsFor(avail, [
                      expandedBucket.date,
                    ]).length > 0;
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
                        <div className="flex shrink-0 items-center gap-1.5">
                          {hasReason ? (
                            <button
                              type="button"
                              onClick={() => setReasonMember(u)}
                              title="불가 사유 보기"
                              className="flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                            >
                              <AlertTriangle className="size-3" />
                            </button>
                          ) : null}
                          <Badge variant="destructive" className="shrink-0">
                            불가능
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={!!reasonMember}
        onOpenChange={(open) => {
          if (!open) setReasonMember(null);
        }}
      >
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>불가 사유</DialogTitle>
            <DialogDescription>
              {reasonMember && expandedBucket
                ? (() => {
                    const { label, dow } = formatDayHeader(expandedBucket.date);
                    return `${reasonMember.displayName || reasonMember.email} · ${dow}요일 · ${label}`;
                  })()
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {reasonMember && expandedBucket
              ? unavailableReasonsFor(
                  resolveAvailability(availMap, reasonMember.uid),
                  [expandedBucket.date],
                ).map(({ date, note }) => {
                  const { label, dow } = formatDayHeader(date);
                  return (
                    <div
                      key={date}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {dow}요일 · {label}
                      </p>
                      <p className="mt-0.5 text-sm">{note}</p>
                    </div>
                  );
                })
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
