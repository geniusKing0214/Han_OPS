"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMyApplications } from "@/hooks/use-my-applications";
import { subscribeMyConfirmedSchedules } from "@/lib/firestore-workforce";
import {
  formatWeekRangeLabel,
  getWeekDates,
  getWeekStartMonday,
  shiftWeek,
  formatDayHeader,
} from "@/lib/workforce-dates";
import type { WorkforceSchedule } from "@/types/workforce";

export default function MyAssignmentsPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday());
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const [schedules, setSchedules] = useState<WorkforceSchedule[]>([]);
  const [error, setError] = useState("");
  const { items: myApplications } = useMyApplications();

  useEffect(() => {
    if (!user) return;
    return subscribeMyConfirmedSchedules(
      user.uid,
      weekStart,
      setSchedules,
      (e) => setError(e.message),
    );
  }, [user, weekStart]);

  /** 이벤트 신청으로 승인·완료된 근무 (직접 배정과 별도 트랙이라 스케줄에
   * 없는 것만 추가로 합쳐서 보여준다) */
  const approvedAppsInWeek = useMemo(() => {
    const scheduleKeys = new Set(
      schedules.map(
        (s) => `${s.sourceEventId ?? ""}::${s.sourceSessionId ?? ""}::${s.date}`,
      ),
    );
    return myApplications.filter(
      (a) =>
        (a.status === "approved" || a.status === "completed") &&
        weekDates.includes(a.date) &&
        !scheduleKeys.has(`${a.eventId ?? ""}::${a.sessionId ?? ""}::${a.date}`),
    );
  }, [myApplications, schedules, weekDates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 주간 배정표"
        description={
          <>
            관리자가 확정한 나의 근무 일정만 표시됩니다.{" "}
            <Link
              href="/my-availability"
              className="text-accent underline-offset-2 hover:underline"
            >
              근무 가능일 선택
            </Link>
            에서 가능한 날을 알려 주세요.
          </>
        }
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
          <span className="min-w-[220px] text-center text-sm tabular-nums">
            {formatWeekRangeLabel(weekStart)}
          </span>
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
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {weekDates.map((date) => {
          const day = schedules.filter((s) => s.date === date);
          const dayApps = approvedAppsInWeek.filter((a) => a.date === date);
          const { label, dow } = formatDayHeader(date);
          return (
            <Card key={date} className="bg-card/60">
              <CardHeader className="space-y-0 p-3 pb-2">
                <CardTitle className="text-center text-xs">
                  {dow}{" "}
                  <span className="tabular-nums text-muted-foreground">
                    {label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {day.length === 0 && dayApps.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-muted-foreground">
                    배정 없음
                  </p>
                ) : (
                  <>
                    {day.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border bg-muted/30 p-2"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: s.color,
                        }}
                      >
                        <p className="text-[11px] font-semibold tabular-nums">
                          {s.startTime}
                        </p>
                        <p className="text-xs font-medium">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.venue || "—"}
                        </p>
                        {s.note ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {s.note}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {dayApps.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-border bg-muted/30 p-2"
                        style={{ borderLeftWidth: 3, borderLeftColor: "#10B981" }}
                      >
                        <p className="text-[11px] font-semibold tabular-nums">
                          {a.slotTime || a.positionSlotTime || "—"}
                        </p>
                        <p className="text-xs font-medium">
                          {a.eventTitle}
                          {a.positionLabel ? ` · ${a.positionLabel}` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.venue || "—"}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
