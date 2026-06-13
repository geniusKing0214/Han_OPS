"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
} from "lucide-react";

import { MonthlySheetCalendarGrid, toYmd } from "@/components/monthly-sheet/monthly-sheet-calendar-grid";
import { MonthlySheetDayDetail } from "@/components/monthly-sheet/monthly-sheet-day-detail";
import { MonthlySheetDayEditor } from "@/components/monthly-sheet/monthly-sheet-day-editor";
import { useAuth } from "@/components/providers/auth-provider";
import { TeamFilter } from "@/components/team/team-filter";
import { useEvents } from "@/hooks/use-events";
import { useMonthlySheetData } from "@/hooks/use-monthly-sheet";
import { exportMonthlySheetCsv } from "@/lib/monthly-sheet-export";
import { saveMonthlySheetAdminMemo } from "@/lib/firestore-monthly-sheets";
import { useMediaQuery } from "@/hooks/use-media-query";
import { monthLabelFromDate } from "@/types/monthly-sheet";
import { DEFAULT_TEAM_ID, type TeamFilterValue, type TeamId } from "@/types/team";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

type Props = {
  mode: "admin" | "member";
};

export function MonthlySheetBoard({ mode }: Props) {
  const { isAdmin, profile } = useAuth();
  const canEdit = mode === "admin" && isAdmin;
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date());
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>(
    isAdmin ? "team_1" : DEFAULT_TEAM_ID,
  );
  const [includePending, setIncludePending] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);

  const { events, loading: eventsLoading } = useEvents();
  const memberTeamId = profile?.teamId ?? DEFAULT_TEAM_ID;
  const {
    days,
    appsLoading,
    appsError,
    adminMemo,
    effectiveTeamFilter,
  } = useMonthlySheetData({
    month,
    teamFilter: canEdit ? teamFilter : memberTeamId,
    includePending,
    isAdmin: canEdit,
    memberTeamId: profile?.teamId,
    events,
  });

  const selectedYmd = toYmd(selected);
  const selectedBundle = days.get(selectedYmd) ?? null;
  const editTeamId: TeamId =
    effectiveTeamFilter === "all" ? "team_1" : effectiveTeamFilter;

  const monthLabel = monthLabelFromDate(month);
  const loading = eventsLoading || appsLoading;

  useEffect(() => {
    setMemoDraft(adminMemo ?? "");
  }, [adminMemo, effectiveTeamFilter, monthLabel]);

  const teamTabs = useMemo(() => {
    if (!canEdit) return null;
    return (
      <TeamFilter
        value={teamFilter}
        onChange={(v) => {
          setTeamFilter(v);
        }}
      />
    );
  }, [canEdit, teamFilter]);

  const handleSelectDate = (d: Date) => {
    setSelected(d);
  };

  const handleExport = () => {
    exportMonthlySheetCsv({
      month,
      teamFilter: effectiveTeamFilter,
      days,
      adminMemo,
    });
  };

  const handleSaveAdminMemo = async () => {
    if (!canEdit || effectiveTeamFilter === "all") return;
    setMemoSaving(true);
    try {
      await saveMonthlySheetAdminMemo(
        month.getFullYear(),
        month.getMonth() + 1,
        effectiveTeamFilter,
        memoDraft,
      );
    } finally {
      setMemoSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg">
                {mode === "admin" ? "월간 취합표" : "팀 월간 취합표"}
              </CardTitle>
              <CardDescription>
                스케줄·승인 신청을 월별·팀별로 자동 취합합니다.
                {canEdit
                  ? " 날짜를 클릭해 수정할 수 있습니다."
                  : " 보기 전용입니다."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={effectiveTeamFilter === "all"}
                >
                  <Download className="size-3.5" />
                  엑셀 다운로드
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                aria-label="이전 달"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="min-w-[8rem] text-center text-base font-semibold tabular-nums">
                {monthLabel}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="다음 달"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {teamTabs}
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant={includePending ? "accent" : "outline"}
                  onClick={() => setIncludePending((v) => !v)}
                >
                  {includePending ? "대기자 포함" : "승인자만"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              취합표 불러오는 중…
            </div>
          ) : null}

          {appsError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {appsError}
            </p>
          ) : null}

          {canEdit && teamFilter === "all" ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              「전체」 탭은 조회 전용입니다. 수정·엑셀 다운로드는 1팀/2팀 탭에서
              선택하세요.
            </p>
          ) : null}

          {!loading ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <MonthlySheetCalendarGrid
                  month={month}
                  selected={selected}
                  onSelect={handleSelectDate}
                  days={days}
                />

                {isMobile ? (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {formatDateLabel(selected)} 상세
                      </h3>
                      {canEdit && effectiveTeamFilter !== "all" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setEditorOpen(true)}
                        >
                          <Pencil className="size-3.5" />
                          수정
                        </Button>
                      ) : null}
                    </div>
                    <MonthlySheetDayDetail
                      bundle={selectedBundle}
                      dateLabel={formatDateLabel(selected)}
                      showTeamBadge={effectiveTeamFilter === "all"}
                    />
                  </div>
                ) : null}
              </div>

              {!isMobile ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">날짜 상세</h3>
                      {canEdit && effectiveTeamFilter !== "all" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setEditorOpen(true)}
                        >
                          <Pencil className="size-3.5" />
                          수정
                        </Button>
                      ) : null}
                    </div>
                    <MonthlySheetDayDetail
                      bundle={selectedBundle}
                      dateLabel={formatDateLabel(selected)}
                      showTeamBadge={effectiveTeamFilter === "all"}
                    />
                  </div>

                  {canEdit && effectiveTeamFilter !== "all" ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold">월간 관리자 메모</h3>
                      <Textarea
                        className="mt-2"
                        rows={3}
                        value={memoDraft}
                        onChange={(e) => setMemoDraft(e.target.value)}
                        placeholder="이번 달 취합표 전체 메모"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        className="mt-2"
                        disabled={memoSaving}
                        onClick={() => void handleSaveAdminMemo()}
                      >
                        메모 저장
                      </Button>
                    </div>
                  ) : adminMemo ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold">월간 메모</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {adminMemo}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canEdit && effectiveTeamFilter !== "all" ? (
        <MonthlySheetDayEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          date={selectedYmd}
          dateLabel={formatDateLabel(selected)}
          teamId={editTeamId}
          bundle={selectedBundle}
          year={month.getFullYear()}
          month={month.getMonth() + 1}
        />
      ) : null}
    </div>
  );
}
