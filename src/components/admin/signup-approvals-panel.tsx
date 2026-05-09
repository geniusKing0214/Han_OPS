"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listPendingUsersForAdmin,
  setUserApprovalStatus,
  type ListedUserRow,
} from "@/lib/firestore-users";

export function SignupApprovalsPanel() {
  const [rows, setRows] = useState<ListedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listPendingUsersForAdmin());
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = async (uid: string, next: "approved" | "rejected") => {
    setBusyUid(uid);
    setError("");
    try {
      await setUserApprovalStatus(uid, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">가입 승인 요청</CardTitle>
          <CardDescription>신규 가입 사용자를 승인/거절합니다.</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          새로고침
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">대기 중인 가입 요청이 없습니다.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.uid}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.displayName?.trim() ? `${row.displayName} (${row.email})` : row.email}
                </p>
                <p className="text-xs text-muted-foreground">uid · {row.uid}</p>
                <Badge variant="warning" className="mt-2">
                  승인 대기
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  disabled={busyUid === row.uid}
                  onClick={() => void decide(row.uid, "approved")}
                >
                  승인
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyUid === row.uid}
                  onClick={() => void decide(row.uid, "rejected")}
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
