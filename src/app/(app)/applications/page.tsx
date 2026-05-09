"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyApplications } from "@/hooks/use-my-applications";
import {
  statusLabels,
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

function rowsForTab(
  tab: ApplicationStatus | "all",
  items: ApplicationItem[],
) {
  if (tab === "all") return items;
  return items.filter((a) => a.status === tab);
}

export default function ApplicationsPage() {
  const [tab, setTab] = useState<(typeof tabConfig)[0]["value"]>("all");
  const { items, loading, error } = useMyApplications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          스케줄에서 신청한 내역이 여기에 표시됩니다.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
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
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
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

        {tabConfig.map((t) => {
          const rows = rowsForTab(t.value, items);
          return (
            <TabsContent key={t.value} value={t.value} className="mt-4">
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
                  ) : (
                    rows.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{a.eventTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {a.venue} ·{" "}
                            <span className="tabular-nums">
                              {a.date} {a.slotTime}
                            </span>
                          </p>
                          {a.note ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              메모: {a.note}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            접수{" "}
                            {a.submittedAt.replace("T", " ").slice(0, 16)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            a.status === "approved"
                              ? "success"
                              : a.status === "pending"
                                ? "warning"
                                : a.status === "rejected"
                                  ? "destructive"
                                  : "default"
                          }
                          className="w-fit shrink-0"
                        >
                          {statusLabels[a.status]}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
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
