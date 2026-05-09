"use client";

import { useState } from "react";

import type { ApplicationItem } from "@/types/application";
import { decideApplication } from "@/lib/firestore-applications";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusLabels } from "@/types/application";

export function AdminConsole({
  pendingApplications,
  loading,
}: {
  pendingApplications: ApplicationItem[];
  loading?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");

  const setStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    setLocalError("");
    setBusyId(id);
    try {
      await decideApplication(id, status);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "상태 변경에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">승인 대기 신청</CardTitle>
        <CardDescription>
          스케줄 신청이 Firestore에 저장되면 여기에서 승인·거절합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {localError ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {localError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : pendingApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            대기 중인 신청이 없습니다.
          </p>
        ) : (
          pendingApplications.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    메모: {a.note}
                  </p>
                ) : null}
                <Badge variant="warning" className="mt-2">
                  {statusLabels[a.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="accent"
                  disabled={busyId === a.id}
                  onClick={() => void setStatus(a.id, "approved")}
                >
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === a.id}
                  onClick={() => void setStatus(a.id, "rejected")}
                >
                  거절
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
