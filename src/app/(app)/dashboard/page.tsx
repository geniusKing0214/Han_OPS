import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Timer,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  dashboardStats,
  todayShifts,
} from "@/data/mock-dashboard";
import { DashboardRecentApplications } from "@/components/dashboard/dashboard-recent-applications";
import { mockNotices, mockAdminAlerts } from "@/data/mock-notices";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          운영 현황 개요 · 데이터 연동 전에는 빈 화면으로 테스트할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 일정</CardTitle>
            <Calendar className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {dashboardStats.todayShiftCount}
            </p>
            <p className="text-xs text-muted-foreground">배정된 근무 블록</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인 대기</CardTitle>
            <Timer className="size-4 text-amber-400/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {dashboardStats.pendingApprovals}
            </p>
            <p className="text-xs text-muted-foreground">관리자 검토 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">신청 가능 일정</CardTitle>
            <ClipboardList className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {dashboardStats.openSlots}
            </p>
            <p className="text-xs text-muted-foreground">슬롯 잔여 존재</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 근무</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-400/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {dashboardStats.monthWorked}
            </p>
            <p className="text-xs text-muted-foreground">확정/완료 기준</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>오늘 근무 리스트</CardTitle>
              <CardDescription>배정 및 상태 요약</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayShifts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  오늘 배정된 근무가 없습니다.
                </p>
              ) : (
                todayShifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.venue} · {s.time}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "confirmed" ? "success" : "warning"}
                    >
                      {s.status === "confirmed" ? "확정" : "대기"}
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
            <CardHeader>
              <CardTitle>최근 공지</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-3">
                {mockNotices.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    공지 없음 · Notices 메뉴에서 확인하세요.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {mockNotices.map((n) => (
                      <li key={n.id} className="text-sm">
                        <p className="font-medium leading-snug">{n.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {n.createdAt.slice(0, 10)}
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

      <Separator className="opacity-60" />
    </div>
  );
}
