"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Trash2 } from "lucide-react";

import { TeamFilter } from "@/components/team/team-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteUserData,
  listUsersForAdmin,
  setUserApprovalStatus,
  setUserRole,
  setUserTeamId,
  type ListedUserRow,
} from "@/lib/firestore-users";
import { useAuth } from "@/components/providers/auth-provider";
import {
  normalizeTeamId,
  TEAM_IDS,
  TEAM_LABELS,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";
import type { UserApprovalStatus, UserRole } from "@/types/user";

const roleLabel: Record<UserRole, string> = {
  admin: "관리자",
  member: "일반",
};

const approvalLabel: Record<UserApprovalStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

function approvalBadgeVariant(status: UserApprovalStatus | undefined) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

export function FirestoreUsersPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ListedUserRow[]>([]);
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<ListedUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (
        teamFilter !== "all" &&
        normalizeTeamId(row.team_id) !== teamFilter
      ) {
        return false;
      }
      if (normalizedQuery.length === 0) return true;
      const nickname = row.displayName?.toLowerCase() ?? "";
      const email = row.email.toLowerCase();
      const uid = row.uid.toLowerCase();
      return (
        nickname.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        uid.includes(normalizedQuery)
      );
    });
  }, [rows, teamFilter, query]);

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

  const onTeamChange = async (uid: string, next: TeamId) => {
    setError("");
    try {
      await setUserTeamId(uid, next);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "팀 변경에 실패했습니다.",
      );
    }
  };

  const onApprovalChange = async (
    uid: string,
    next: UserApprovalStatus,
    teamId: TeamId,
  ) => {
    setError("");
    try {
      await setUserApprovalStatus(uid, next, teamId);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "승인 상태 변경에 실패했습니다.",
      );
    }
  };

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await deleteUserData(deleteTarget.uid);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">사용자 관리</CardTitle>
          <CardDescription>
            팀별 멤버 구분 · 역할과 승인 상태를 관리합니다.
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TeamFilter value={teamFilter} onChange={setTeamFilter} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임, 이메일, uid 검색"
            className="sm:max-w-xs"
            aria-label="사용자 검색"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          표시 {filteredRows.length}명 / 전체 {rows.length}명
        </p>

        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {query.trim()
              ? "검색 결과가 없습니다."
              : "표시할 사용자가 없습니다."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const isSelf = row.uid === user?.uid;
              const role: UserRole =
                row.role === "admin" ? "admin" : "member";
              const teamId = normalizeTeamId(row.team_id);
              const accountStatus: UserApprovalStatus =
                row.accountStatus === "pending" ||
                row.accountStatus === "approved" ||
                row.accountStatus === "rejected"
                  ? row.accountStatus
                  : "approved";

              return (
                <div
                  key={row.uid}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.displayName?.trim() || row.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{TEAM_LABELS[teamId]}</Badge>
                      <Badge variant={role === "admin" ? "accent" : "outline"}>
                        {roleLabel[role]}
                      </Badge>
                      <Badge variant={approvalBadgeVariant(accountStatus)}>
                        {approvalLabel[accountStatus]}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-border bg-muted px-2 text-sm"
                      value={teamId}
                      onChange={(e) =>
                        void onTeamChange(row.uid, e.target.value as TeamId)
                      }
                      aria-label="팀"
                    >
                      {TEAM_IDS.map((id) => (
                        <option key={id} value={id}>
                          {TEAM_LABELS[id]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-border bg-muted px-2 text-sm"
                      value={role}
                      onChange={(e) =>
                        void onRoleChange(row.uid, e.target.value as UserRole)
                      }
                      aria-label="역할"
                    >
                      <option value="member">일반</option>
                      <option value="admin">관리자</option>
                    </select>
                    <select
                      className="h-9 rounded-md border border-border bg-muted px-2 text-sm"
                      value={accountStatus}
                      onChange={(e) =>
                        void onApprovalChange(
                          row.uid,
                          e.target.value as UserApprovalStatus,
                          teamId,
                        )
                      }
                      aria-label="승인 상태"
                    >
                      <option value="pending">승인 대기</option>
                      <option value="approved">승인됨</option>
                      <option value="rejected">거절됨</option>
                    </select>
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">본인</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => setDeleteTarget(row)}
                        aria-label="유저 삭제"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {/* 삭제 확인 다이얼로그 */}
    <Dialog
      open={!!deleteTarget}
      onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
    >
      <DialogContent className="sm:max-w-sm sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>유저 데이터 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {deleteTarget?.displayName?.trim() || deleteTarget?.email}
            </span>
            의 Firestore 데이터를 삭제합니다.
          </p>
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
            삭제되는 항목: 프로필, 근무 가능일 데이터
            <br />
            복구 불가 · Firebase Auth 계정은 별도 삭제 필요
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 gap-2"
              onClick={() => void onDeleteConfirm()}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {deleting ? "삭제 중…" : "삭제 확인"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

