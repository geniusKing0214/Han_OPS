"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApplicationListByMonth } from "@/components/applications/application-list-by-month";
import { MyApplicationRow } from "@/components/applications/my-application-row";
import { useAuth } from "@/components/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useMyApplications } from "@/hooks/use-my-applications";
import { useEvents } from "@/hooks/use-events";
import { filterApplicationsMatchingLiveSchedule } from "@/lib/applications-match-schedule";
import { buildApplicationDateMarkers } from "@/lib/schedule-calendar-markers";
import { MiniCalendar, toYMD } from "@/components/schedule/mini-calendar";
import { Button } from "@/components/ui/button";
import {
  type ApplicationItem,
  type ApplicationStatus,
} from "@/types/application";

const tabConfig: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "approved", label: "승인 완료" },
  { value: "pending", label: "대기 중" },
  { value: "rejected", label: "거절됨" },
  { value: "completed", label: "완료됨" },
];

type TabValue = (typeof tabConfig)[number]["value"];

function parseTab(raw: string | null): TabValue {
  if (
    raw === "all" ||
    raw === "approved" ||
    raw === "pending" ||
    raw === "rejected" ||
    raw === "completed"
  ) {
    return raw;
  }
  return "all";
}

function rowsForTab(
  tab: ApplicationStatus | "all",
  items: ApplicationItem[],
) {
  if (tab === "all") return items;
  return items.filter((a) => a.status === tab);
}

function ApplicationsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabValue>(() =>
    parseTab(searchParams.get("tab")),
  );

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { items: rawItems, loading: appsLoading, error } = useMyApplications();
  const { events, loading: eventsLoading } = useEvents();
  const items = useMemo(
    () => filterApplicationsMatchingLiveSchedule(rawItems, events),
    [rawItems, events],
  );
  const loading = appsLoading || eventsLoading;

  const activeRows = useMemo(() => rowsForTab(tab, items), [tab, items]);
  const dateMarkers = useMemo(
    () => buildApplicationDateMarkers(activeRows, events),
    [activeRows, events],
  );
  const selectedYmd = toYMD(selectedDate);
  const selectedRows = useMemo(
    () =>
      activeRows
        .filter((a) => a.date === selectedYmd)
        .sort((a, b) => a.slotTime.localeCompare(b.slotTime)),
    [activeRows, selectedYmd],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="스케줄에서 신청한 내역이 여기에 표시됩니다. 대기·승인 상태는 직접 취소할 수 있습니다."
      />

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {error}
          <span className="mt-1 block text-xs text-muted-foreground">
            Firebase 콘솔에서 applications 컬렉션 규칙이 게시되었는지 확인하세요.
          </span>
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ApplicationStatus | "all")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1">
            <TabsList className="inline-flex h-auto min-w-full flex-wrap justify-start gap-1 bg-muted p-1 sm:flex-nowrap">
              {tabConfig.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="shrink-0 data-[state=active]:text-foreground"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex shrink-0 gap-1 rounded-md border border-border bg-card p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "accent" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              목록
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "calendar" ? "accent" : "ghost"}
              onClick={() => setViewMode("calendar")}
            >
              달력
            </Button>
          </div>
        </div>

        {tabConfig.map((t) => {
          const rows = rowsForTab(t.value, items);
          return (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {viewMode === "list" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t.label}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {rows.length}건
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        불러오는 중...
                      </p>
                    ) : rows.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        해당 상태의 신청이 없습니다.
                      </p>
                    ) : user ? (
                      <ApplicationListByMonth items={rows} userId={user.uid} />
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
                  <MiniCalendar
                    month={month}
                    selected={selectedDate}
                    onMonthChange={setMonth}
                    onSelect={setSelectedDate}
                    dateMarkers={dateMarkers}
                    mode="full"
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {t.label} · {selectedYmd}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {selectedRows.length}건
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {loading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          불러오는 중...
                        </p>
                      ) : selectedRows.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          선택한 날짜 신청 내역이 없습니다.
                        </p>
                      ) : user ? (
                        selectedRows.map((a) => (
                          <MyApplicationRow
                            key={a.id}
                            app={a}
                            userId={user.uid}
                            compact
                          />
                        ))
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {!loading && items.length === 0 && !error ? (
        <p className="text-center text-xs text-muted-foreground">
          Schedule에서 슬롯을 신청하면 여기에 쌓입니다.
        </p>
      ) : null}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center text-sm text-muted-foreground">
          불러오는 중...
        </p>
      }
    >
      <ApplicationsPageContent />
    </Suspense>
  );
}

