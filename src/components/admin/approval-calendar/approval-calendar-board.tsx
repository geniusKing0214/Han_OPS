"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

import { ApprovalCalendarGrid } from "@/components/admin/approval-calendar/approval-calendar-grid";
import { useEvents } from "@/hooks/use-events";
import { subscribeApplicationsInMonthForAdmin } from "@/lib/firestore-applications";
import { buildApprovalCalendarDays } from "@/lib/approval-calendar-aggregator";
import { exportApprovalCalendarXlsx } from "@/lib/approval-calendar-export";
import { monthKeyFromDate, monthLabelFromDate } from "@/types/monthly-sheet";
import type { ApplicationItem } from "@/types/application";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function ApprovalCalendarBoard() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState("");
  const [exporting, setExporting] = useState(false);

  const { events, loading: eventsLoading } = useEvents();
  const monthKey = monthKeyFromDate(month);

  useEffect(() => {
    setAppsLoading(true);
    setAppsError("");
    const unsub = subscribeApplicationsInMonthForAdmin(
      monthKey,
      (items) => {
        setApplications(items);
        setAppsLoading(false);
      },
      (err) => {
        setAppsError(err.message || "신청 데이터를 불러오지 못했습니다.");
        setAppsLoading(false);
      },
    );
    return unsub;
  }, [monthKey]);

  const days = useMemo(
    () =>
      buildApprovalCalendarDays({
        year: month.getFullYear(),
        monthIndex: month.getMonth(),
        events,
        applications,
      }),
    [month, events, applications],
  );

  const loading = appsLoading || eventsLoading;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApprovalCalendarXlsx(month, days);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>승인 달력</CardTitle>
            <CardDescription>
              승인된 신청이 자동으로 날짜별 이벤트 색상과 함께 기록됩니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                aria-label="이전 달"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[92px] text-center text-sm font-semibold tabular-nums">
                {monthLabelFromDate(month)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="다음 달"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={loading || exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              엑셀 다운로드
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {appsError ? (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {appsError}
            </p>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              불러오는 중...
            </div>
          ) : (
            <ApprovalCalendarGrid month={month} days={days} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
