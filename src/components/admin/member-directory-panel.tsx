"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { TeamFilter } from "@/components/team/team-filter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  listUsersForAdmin,
  type ListedUserRow,
} from "@/lib/firestore-users";
import { exportMemberDirectoryXlsx } from "@/lib/member-directory-export";
import { normalizeTeamId, TEAM_LABELS, type TeamFilterValue } from "@/types/team";

export function MemberDirectoryPanel() {
  const [rows, setRows] = useState<ListedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [exporting, setExporting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listUsersForAdmin();
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (teamFilter !== "all" && normalizeTeamId(row.team_id) !== teamFilter) {
        return false;
      }
      if (normalizedQuery.length === 0) return true;
      const nickname = row.displayName?.toLowerCase() ?? "";
      const email = row.email.toLowerCase();
      const phone = row.phone?.toLowerCase() ?? "";
      return (
        nickname.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        phone.includes(normalizedQuery)
      );
    });
  }, [rows, teamFilter, query]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMemberDirectoryXlsx(filteredRows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="회원관리"
        description="가입자 이름·이메일·연락처를 확인하고 엑셀로 추출합니다."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">회원 목록</CardTitle>
            <CardDescription>
              표시 {filteredRows.length}명 / 전체 {rows.length}명
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="gap-1.5"
            disabled={exporting || filteredRows.length === 0}
            onClick={() => void handleExport()}
          >
            <Download className="size-4" />
            {exporting ? "내보내는 중..." : "엑셀로 추출"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TeamFilter value={teamFilter} onChange={setTeamFilter} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 이메일, 연락처 검색"
              className="sm:max-w-xs"
              aria-label="회원 검색"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {query.trim() ? "검색 결과가 없습니다." : "표시할 회원이 없습니다."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">이름</th>
                    <th className="px-3 py-2 font-medium">이메일</th>
                    <th className="px-3 py-2 font-medium">연락처</th>
                    <th className="px-3 py-2 font-medium">팀</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.uid} className="border-b border-border last:border-0">
                      <td className="truncate px-3 py-2 font-medium">
                        {row.displayName?.trim() || "—"}
                      </td>
                      <td className="truncate px-3 py-2 text-muted-foreground">
                        {row.email}
                      </td>
                      <td className="truncate px-3 py-2 text-muted-foreground">
                        {row.phone?.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {TEAM_LABELS[normalizeTeamId(row.team_id)]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
