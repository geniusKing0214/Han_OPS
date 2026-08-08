"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACTIVITY_LOG_LABELS,
  subscribeActivityLogs,
  type ActivityLogAction,
  type ActivityLogItem,
} from "@/lib/firestore-activity-log";
import { getUserProfilesByIds } from "@/lib/firestore-users";

const ACTION_BADGE_VARIANT: Record<
  ActivityLogAction,
  "success" | "destructive" | "warning" | "accent"
> = {
  application_approved: "success",
  application_rejected: "destructive",
  application_cancel_approved: "warning",
  application_cancel_rejected: "warning",
  schedule_created: "accent",
  schedule_deleted: "destructive",
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export function ActivityLogPanel() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState<
    Map<string, { email: string; displayName: string }>
  >(new Map());

  useEffect(
    () =>
      subscribeActivityLogs(
        (rows) => {
          setLogs(rows);
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    [],
  );

  const actorIdsKey = useMemo(
    () => [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))].join("|"),
    [logs],
  );

  useEffect(() => {
    const ids = actorIdsKey ? actorIdsKey.split("|") : [];
    if (ids.length === 0) {
      setProfiles(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const map = await getUserProfilesByIds(ids);
        if (!cancelled) setProfiles(map);
      } catch {
        if (!cancelled) setProfiles(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actorIdsKey]);

  const resolveActorName = (uid: string) =>
    profiles.get(uid)?.displayName || profiles.get(uid)?.email || uid;

  return (
    <div className="space-y-6">
      <PageHeader
        title="활동 로그"
        description="누가 신청을 승인·거절·취소 처리했는지, 누가 스케줄을 등록·삭제했는지 확인합니다."
      />

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-2 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              아직 기록된 활동이 없습니다.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={ACTION_BADGE_VARIANT[log.action]}>
                      {ACTIVITY_LOG_LABELS[log.action]}
                    </Badge>
                    <span className="text-sm font-medium">
                      {resolveActorName(log.actorUserId)}
                    </span>
                    {log.eventTitle ? (
                      <span className="text-sm text-muted-foreground">
                        · {log.eventTitle}
                      </span>
                    ) : null}
                    {log.targetUserName ? (
                      <span className="text-sm text-muted-foreground">
                        → {log.targetUserName}
                      </span>
                    ) : null}
                  </div>
                  {log.detail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {log.detail}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
