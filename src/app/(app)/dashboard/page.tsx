"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar, CalendarDays, ClipboardList, Timer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardRecentApplications } from "@/components/dashboard/dashboard-recent-applications";
import { ImportantNoticeDialog } from "@/components/dashboard/important-notice-dialog";
import { MyAvailabilityDialog } from "@/components/availability/my-availability-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useMyApplications } from "@/hooks/use-my-applications";
import { useEvents } from "@/hooks/use-events";
import { useNotices } from "@/hooks/use-notices";
import { filterApplicationsMatchingLiveSchedule } from "@/lib/applications-match-schedule";
import {
  currentMonthKey,
  filterApplicationsInMonth,
  formatApplicationMonthLabel,
} from "@/lib/application-grouping";
import { countAvailableApplicationEvents } from "@/lib/schedule-availability";
import { subscribeMyAvailability } from "@/lib/firestore-workforce";
import {
  getNextWeekStart,
  getWeekDates,
} from "@/lib/workforce-dates";
import { isUserAvailableOnDate } from "@/lib/workforce-logic";
import { normalizeTeamId } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { statusLabels } from "@/types/application";
import { TEAM_LABELS } from "@/types/team";
import { mockAdminAlerts } from "@/data/mock-notices";

function StatCard({
  title,
  value,
  hint,
  icon,
  href,
  onClick,
}: {
  title: string;
  value: number;
  hint: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(href || onClick);
  const card = (
    <Card
      className={cn(
        interactive &&
          "transition-colors hover:border-accent/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {card}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {card}
      </button>
    );
  }

  return card;
}

const RECENT_NOTICES_LIMIT = 3;

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatNoticeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { dateStyle: "medium" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function DashboardPage() {
  const { user, isAdmin, profile } = useAuth();
  const { items: rawApplications, loading: appsLoading } = useMyApplications();
  const { events } = useEvents();
  const { rows: notices, loading: noticesLoading } = useNotices();
  const recentNotices = useMemo(() => notices.slice(0, RECENT_NOTICES_LIMIT), [notices]);
  const myApplications = useMemo(
    () => filterApplicationsMatchingLiveSchedule(rawApplications, events),
    [rawApplications, events],
  );
  const today = toYmd(new Date());
  const thisMonth = currentMonthKey();
  const thisMonthLabel = formatApplicationMonthLabel(thisMonth);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availableDays, setAvailableDays] = useState(0);

  const nextWeekStart = useMemo(() => getNextWeekStart(), []);
  const nextWeekDates = useMemo(
    () => getWeekDates(nextWeekStart),
    [nextWeekStart],
  );

  useEffect(() => {
    if (!user) return;
    return subscribeMyAvailability(
      user.uid,
      (row) => {
        if (!row) {
          setAvailableDays(0);
          return;
        }
        setAvailableDays(
          nextWeekDates.filter((d) => isUserAvailableOnDate(row, d)).length,
        );
      },
      () => setAvailableDays(0),
    );
  }, [user, nextWeekDates]);

  const handleAvailableCountChange = useCallback((count: number) => {
    setAvailableDays(count);
  }, []);

  const stats = useMemo(() => {
    const approvedApps = myApplications.filter((a) => a.status === "approved");
    const uniqApprovedToday = new Set(
      approvedApps
        .filter((a) => a.date === today)
        .map((a) => a.eventId ?? a.eventTitle),
    );
    const todayCount = uniqApprovedToday.size;
    const pending = myApplications.filter((a) => a.status === "pending").length;

    const appliedEventIds = new Set(
      myApplications
        .filter(
          (a) =>
            (a.status === "pending" ||
              a.status === "approved" ||
              a.status === "completed") &&
            a.eventId,
        )
        .map((a) => a.eventId as string),
    );
    const openSlotsTeamId = isAdmin ? undefined : normalizeTeamId(profile?.teamId);
    const openSlots = countAvailableApplicationEvents(
      events,
      appliedEventIds,
      today,
      openSlotsTeamId,
    );
    return {
      todayShiftCount: todayCount,
      pendingApprovals: pending,
      openSlots,
      openSlotsTeamLabel: isAdmin
        ? "전체 팀"
        : TEAM_LABELS[normalizeTeamId(profile?.teamId)],
    };
  }, [events, isAdmin, myApplications, profile?.teamId, today]);

  const myBlocks = useMemo(
    () =>
      filterApplicationsInMonth(
        myApplications.filter((a) => a.status !== "rejected"),
        thisMonth,
      )
        .sort((a, b) =>
          `${b.date} ${b.slotTime}`.localeCompare(`${a.date} ${a.slotTime}`),
        )
        .slice(0, 3),
    [myApplications, thisMonth],
  );

  return (
    <div className="space-y-8">
      <ImportantNoticeDialog />
      <MyAvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        onAvailableCountChange={handleAvailableCountChange}
      />
      <PageHeader
        title="Dashboard"
        description="운영 현황 개요 · 데이터 연동 전에는 빈 화면으로 테스트할 수 있습니다."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="오늘 일정"
          value={stats.todayShiftCount}
          hint="배정된 근무 블록"
          icon={<Calendar className="size-4 text-accent" />}
          href="/schedule"
        />
        <StatCard
          title="승인 대기"
          value={stats.pendingApprovals}
          hint="관리자 검토 필요"
          icon={<Timer className="size-4 text-amber-400/90" />}
          href="/applications?tab=pending"
        />
        <StatCard
          title="신청 가능 일정"
          value={stats.openSlots}
          hint={`${stats.openSlotsTeamLabel} · 오늘 이후 · 정원 여유 있는 일정`}
          icon={<ClipboardList className="size-4 text-muted-foreground" />}
          href="/schedule"
        />
        <StatCard
          title="근무 가능일"
          value={availableDays}
          hint="익주 가능 일수 · 탭하여 신청"
          icon={<CalendarDays className="size-4 text-emerald-400/90" />}
          onClick={() => setAvailabilityOpen(true)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>내 신청 블록</CardTitle>
              <CardDescription>
                {thisMonthLabel} 최근 3건 · 전체는 Applications에서 확인
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {appsLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  불러오는 중...
                </p>
              ) : myBlocks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {thisMonthLabel} 신청한 블록이 없습니다.
                </p>
              ) : (
                myBlocks.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.eventTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.venue} · {s.date} {s.slotTime}
                      </p>
                    </div>
                    <Badge
                      variant={
                        s.status === "approved"
                          ? "success"
                          : s.status === "pending"
                            ? "warning"
                            : s.status === "completed"
                              ? "default"
                              : "destructive"
                      }
                    >
                      {statusLabels[s.status]}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <DashboardRecentApplications />
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>최근 공지</CardTitle>
              <Link
                href="/notices"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                전체 보기
              </Link>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-3">
                {noticesLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    불러오는 중...
                  </p>
                ) : recentNotices.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    공지 없음 · Notices 메뉴에서 확인하세요.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {recentNotices.map((n) => (
                      <li key={n.id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium leading-snug">{n.title}</p>
                          {n.is_important ? (
                            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                              중요
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNoticeDate(n.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>관리자 알림</CardTitle>
              <CardDescription>운영 콘솔 요약</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAdminAlerts.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  알림 없음
                </p>
              ) : (
                mockAdminAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {a.message}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
