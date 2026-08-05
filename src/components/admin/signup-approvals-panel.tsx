"use client";

import { useCallback, useEffect, useState } from "react";

import { TeamFilter } from "@/components/team/team-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listPendingUsersForAdmin,
  setUserApprovalStatus,
  subscribePendingUsersForAdmin,
  type ListedUserRow,
} from "@/lib/firestore-users";
import {
  DEFAULT_TEAM_ID,
  normalizeTeamId,
  TEAM_IDS,
  TEAM_LABELS,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";

export function SignupApprovalsPanel() {
  const [rows, setRows] = useState<ListedUserRow[]>([]);
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [teamByUid, setTeamByUid] = useState<Record<string, TeamId>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listPendingUsersForAdmin();
      setRows(list);
      setTeamByUid((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (!next[row.uid]) {
            next[row.uid] = normalizeTeamId(row.team_id);
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = subscribePendingUsersForAdmin(
      (list) => {
        setRows(list);
        setTeamByUid((prev) => {
          const next = { ...prev };
          for (const row of list) {
            if (!next[row.uid]) {
              next[row.uid] = normalizeTeamId(row.team_id);
            }
          }
          return next;
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message || "가입 요청을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const decide = async (uid: string, next: "approved" | "rejected") => {
    setBusyUid(uid);
    setError("");
    const teamId = teamByUid[uid] ?? DEFAULT_TEAM_ID;
    try {
      if (next === "approved") {
        await setUserApprovalStatus(uid, "approved", teamId);
      } else {
        await setUserApprovalStatus(uid, "rejected");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setBusyUid(null);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows
    .filter((row) => {
      if (teamFilter !== "all" && normalizeTeamId(row.team_id) !== teamFilter) {
        const selected = teamByUid[row.uid] ?? DEFAULT_TEAM_ID;
        if (selected !== teamFilter) return false;
      }
      return true;
    })
    .filter((row) => {
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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">가입 승인 요청</CardTitle>
          <CardDescription>
            승인 시 소속 팀을 지정합니다. 기본값은 1팀입니다.
          </CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          새로고침
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임, 이메일, uid 검색"
            className="sm:max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            대기 {filteredRows.length}건 / 전체 {rows.length}건
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">대기 중인 가입 요청이 없습니다.</p>
        ) : (
          filteredRows.map((row) => {
            const teamId = teamByUid[row.uid] ?? DEFAULT_TEAM_ID;
            return (
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
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-muted px-2 text-sm"
                    value={teamId}
                    onChange={(e) =>
                      setTeamByUid((prev) => ({
                        ...prev,
                        [row.uid]: e.target.value as TeamId,
                      }))
                    }
                    aria-label="승인 팀"
                  >
                    {TEAM_IDS.map((id) => (
                      <option key={id} value={id}>
                        {TEAM_LABELS[id]}
                      </option>
                    ))}
                  </select>
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
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
