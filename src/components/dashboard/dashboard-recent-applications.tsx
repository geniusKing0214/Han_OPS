"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMyApplications } from "@/hooks/use-my-applications";
import { statusLabels } from "@/types/application";

export function DashboardRecentApplications() {
  const { items, loading } = useMyApplications();
  const recentApps = items.slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 신청 현황</CardTitle>
        <CardDescription>최근 제출 순 · Applications와 동일 데이터</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            불러오는 중...
          </p>
        ) : recentApps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            신청 내역이 없습니다.
          </p>
        ) : (
          recentApps.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.eventTitle}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {a.date} {a.slotTime}
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
              >
                {statusLabels[a.status]}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
