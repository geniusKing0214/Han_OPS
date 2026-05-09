"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listUsersForAdmin,
  setUserRole,
  type ListedUserRow,
} from "@/lib/firestore-users";
import { useAuth } from "@/components/providers/auth-provider";
import type { UserRole } from "@/types/user";

const roleLabel: Record<UserRole, string> = {
  admin: "관리자",
  member: "일반",
};

export function FirestoreUsersPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ListedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listUsersForAdmin();
      setRows(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "사용자 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRoleChange = async (uid: string, next: UserRole) => {
    setError("");
    try {
      await setUserRole(uid, next);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "권한 변경에 실패했습니다.",
      );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">사용자 관리</CardTitle>
          <CardDescription>
            Firestore users 문서 · 역할은 관리자(admin) / 일반(member)입니다.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          새로고침
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
            <span className="mt-1 block text-muted-foreground">
              Firestore 규칙이 게시되었는지, Database가 생성되었는지 확인하세요.
            </span>
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 사용자 문서가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isSelf = row.uid === user?.uid;
              const role: UserRole =
                row.role === "admin" ? "admin" : "member";
              return (
                <div key={row.uid}>
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.displayName?.trim() || row.email}
                      </p>
                      {row.displayName?.trim() ? (
                        <p className="truncate text-xs text-muted-foreground">
                          이메일 · {row.email}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        uid · {row.uid}
                      </p>
                      <Badge
                        variant={role === "admin" ? "accent" : "outline"}
                        className="mt-2"
                      >
                        {roleLabel[role]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${row.uid}`}>
                        역할
                      </label>
                      <select
                        id={`role-${row.uid}`}
                        className="h-9 rounded-md border border-border bg-muted px-2 text-sm text-foreground"
                        value={role}
                        onChange={(e) =>
                          void onRoleChange(
                            row.uid,
                            e.target.value as UserRole,
                          )
                        }
                      >
                        <option value="member">일반 (member)</option>
                        <option value="admin">관리자 (admin)</option>
                      </select>
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">
                          본인
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
