"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamFilter } from "@/components/team/team-filter";
import { useAuth } from "@/components/providers/auth-provider";
import { useEvents } from "@/hooks/use-events";
import { formatAttendanceDateTime } from "@/lib/attendance-window";
import {
  reviewAttendance,
  subscribeAllAttendances,
} from "@/lib/firestore-attendance";
import { useEffect } from "react";
import {
  LOCATION_STATUS_LABELS,
  PHOTO_STATUS_LABELS,
  REJECTION_REASONS,
  REVIEW_STATUS_LABELS,
  TIME_STATUS_LABELS,
  type AttendanceRecord,
} from "@/types/attendance";
import { TEAM_LABELS, type TeamFilterValue } from "@/types/team";
import { normalizeTeamId } from "@/lib/team-utils";

function toYmd(d = new Date()) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

/** 서버 GPS 재검증 또는 클라이언트 Mock Location 탐지에서 위조 의심 신호가 있었는지 */
function isGpsSuspicious(r: AttendanceRecord): boolean {
  return r.gpsSuspicious === true || r.mockLocationRiskLevel === "high";
}

function gpsSuspiciousReasons(r: AttendanceRecord): string[] {
  return [...(r.gpsSuspiciousReasons ?? []), ...(r.mockLocationReasons ?? [])];
}

export function AttendanceAdminPanel() {
  const { user, isAdmin } = useAuth();
  const { events } = useEvents();
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(toYmd());
  const [month, setMonth] = useState(toYmd().slice(0, 7));
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [eventId, setEventId] = useState("all");
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState("all");

  const [detail, setDetail] = useState<AttendanceRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribeAllAttendances(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
  }, []);

  const listRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (date && r.workDate !== date) return false;
      if (!date && month && !r.workDate.startsWith(month)) return false;
      if (teamFilter !== "all" && normalizeTeamId(r.teamId) !== teamFilter) {
        return false;
      }
      if (eventId !== "all" && r.eventId !== eventId) return false;
      if (q && !r.userName.toLowerCase().includes(q)) return false;
      if (reviewFilter !== "all" && r.reviewStatus !== reviewFilter) return false;
      if (timeFilter === "normal" && r.timeStatus !== "normal") return false;
      if (timeFilter === "late" && r.timeStatus === "normal") return false;
      if (
        locFilter === "ok" &&
        r.locationStatus !== "inside_radius" &&
        r.locationStatus !== "not_required"
      ) {
        return false;
      }
      if (
        locFilter === "need" &&
        (r.locationStatus === "inside_radius" ||
          r.locationStatus === "not_required")
      ) {
        return false;
      }
      if (photoFilter !== "all" && r.photoStatus !== photoFilter) return false;
      return true;
    });
  }, [
    rows,
    date,
    month,
    teamFilter,
    eventId,
    query,
    reviewFilter,
    timeFilter,
    locFilter,
    photoFilter,
  ]);

  const today = toYmd();
  const todayRows = rows.filter((r) => r.workDate === today);
  const summary = {
    checkedIn: todayRows.length,
    pendingReview: todayRows.filter((r) => r.reviewStatus === "pending").length,
    approved: todayRows.filter((r) => r.reviewStatus === "approved").length,
    late: todayRows.filter((r) => r.timeStatus !== "normal").length,
    locNeed: todayRows.filter(
      (r) =>
        r.locationStatus === "outside_radius" ||
        r.locationStatus === "low_accuracy" ||
        r.locationStatus === "location_unavailable",
    ).length,
    normal: todayRows.filter((r) => r.timeStatus === "normal").length,
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        관리자만 출근 인증 관리에 접근할 수 있습니다.
      </p>
    );
  }

  const onApprove = async () => {
    if (!detail || !user) return;
    setBusy(true);
    setError("");
    try {
      await reviewAttendance({
        attendanceId: detail.id,
        adminUid: user.uid,
        decision: "approved",
        adminMemo: memo,
      });
      setConfirmOpen(false);
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "확인 처리 실패");
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!detail || !user) return;
    setBusy(true);
    setError("");
    try {
      await reviewAttendance({
        attendanceId: detail.id,
        adminUid: user.uid,
        decision: "rejected",
        adminMemo: memo,
        rejectionReason: rejectReason,
      });
      setRejectOpen(false);
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "반려 처리 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["오늘 인증 건수", summary.checkedIn],
          ["정상 출근", summary.normal],
          ["지각", summary.late],
          ["위치 확인 필요", summary.locNeed],
          ["확인 대기", summary.pendingReview],
          ["확인 완료", summary.approved],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">날짜</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">조회 월</span>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground">팀</span>
            <TeamFilter value={teamFilter} onChange={setTeamFilter} />
          </div>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">이벤트</span>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="all">전체</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">이름 검색</span>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="사용자 이름" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">확인 상태</span>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="pending">대기</option>
              <option value="approved">확인 완료</option>
              <option value="rejected">반려</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">정상/지각</span>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="normal">정상</option>
              <option value="late">지각</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">위치</span>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="ok">정상</option>
              <option value="need">확인 필요</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">사진 상태</span>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
              value={photoFilter}
              onChange={(e) => setPhotoFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="active">보관 중</option>
              <option value="scheduled_for_deletion">삭제 예정</option>
              <option value="deleted">삭제 완료</option>
            </select>
          </label>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : listRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">표시할 출근 인증이 없습니다.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">팀</th>
                  <th className="px-3 py-2">이벤트</th>
                  <th className="px-3 py-2">예정</th>
                  <th className="px-3 py-2">인증</th>
                  <th className="px-3 py-2">시간</th>
                  <th className="px-3 py-2">위치</th>
                  <th className="px-3 py-2">확인</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {listRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.userName}</td>
                    <td className="px-3 py-2">{TEAM_LABELS[normalizeTeamId(r.teamId)]}</td>
                    <td className="px-3 py-2">{r.eventName}</td>
                    <td className="px-3 py-2 tabular-nums">{r.slotTime}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.actualCheckInAt
                        ? formatAttendanceDateTime(r.actualCheckInAt)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{TIME_STATUS_LABELS[r.timeStatus]}</td>
                    <td className="px-3 py-2">
                      {LOCATION_STATUS_LABELS[r.locationStatus]}
                      {r.distanceFromVenueMeters != null
                        ? ` · ${r.distanceFromVenueMeters}m`
                        : ""}
                      {isGpsSuspicious(r) ? (
                        <Badge variant="destructive" className="ml-1.5">
                          GPS 의심
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{REVIEW_STATUS_LABELS[r.reviewStatus]}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDetail(r);
                          setMemo(r.adminMemo || "");
                        }}
                      >
                        상세
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {listRows.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TEAM_LABELS[normalizeTeamId(r.teamId)]} · {r.eventName}
                      </p>
                    </div>
                    <Badge
                      variant={
                        r.reviewStatus === "approved"
                          ? "success"
                          : r.reviewStatus === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {REVIEW_STATUS_LABELS[r.reviewStatus]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    예정 {r.slotTime} · 인증{" "}
                    {r.actualCheckInAt
                      ? formatAttendanceDateTime(r.actualCheckInAt)
                      : "—"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{TIME_STATUS_LABELS[r.timeStatus]}</Badge>
                    <Badge variant="outline">
                      {LOCATION_STATUS_LABELS[r.locationStatus]}
                      {r.distanceFromVenueMeters != null
                        ? ` ${r.distanceFromVenueMeters}m`
                        : ""}
                    </Badge>
                    {isGpsSuspicious(r) ? (
                      <Badge variant="destructive">GPS 의심</Badge>
                    ) : null}
                  </div>
                  <Button
                    className="h-11 w-full"
                    variant="outline"
                    onClick={() => {
                      setDetail(r);
                      setMemo(r.adminMemo || "");
                    }}
                  >
                    인증 상세 보기
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>출근 인증 상세</DialogTitle>
                <DialogDescription>
                  {detail.userName} · {detail.eventName}
                </DialogDescription>
              </DialogHeader>
              {detail.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.photoUrl}
                  alt="인증 사진"
                  className="max-h-72 w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <p className="rounded-md border border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {PHOTO_STATUS_LABELS[detail.photoStatus]}
                </p>
              )}
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>팀: {TEAM_LABELS[normalizeTeamId(detail.teamId)]}</p>
                <p>
                  근무일: {detail.workDate} · 예정 {detail.slotTime}
                </p>
                <p>
                  실제 인증:{" "}
                  {detail.actualCheckInAt
                    ? formatAttendanceDateTime(detail.actualCheckInAt)
                    : "—"}
                </p>
                <p>시간 상태: {TIME_STATUS_LABELS[detail.timeStatus]}</p>
                <p>
                  위치: {LOCATION_STATUS_LABELS[detail.locationStatus]}
                  {detail.distanceFromVenueMeters != null
                    ? ` · ${detail.distanceFromVenueMeters}m`
                    : ""}
                  {detail.accuracy != null ? ` · 정확도 ±${Math.round(detail.accuracy)}m` : ""}
                </p>
                <p>
                  GPS: {detail.latitude ?? "—"}, {detail.longitude ?? "—"}
                  {detail.serverDistanceMeters != null
                    ? ` · 서버 재검증 거리 ${detail.serverDistanceMeters}m`
                    : ""}
                </p>
                <p>확인: {REVIEW_STATUS_LABELS[detail.reviewStatus]}</p>
              </div>
              {isGpsSuspicious(detail) ? (
                <div className="space-y-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                  <p className="font-medium">GPS 위조 의심</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {gpsSuspiciousReasons(detail).map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">관리자 메모</span>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </label>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {detail.reviewStatus === "pending" ? (
                  <>
                    <Button
                      variant="outline"
                      className="border-red-500/40 text-red-700"
                      onClick={() => setRejectOpen(true)}
                    >
                      반려 / 재인증 요청
                    </Button>
                    <Button variant="accent" onClick={() => setConfirmOpen(true)}>
                      확인 완료
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    닫기
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>출근 인증 확인 완료</DialogTitle>
            <DialogDescription>
              확인 완료 시 출근 기록은 유지되며, 인증 사진은 확인 시점으로부터 24시간 후
              자동 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button variant="accent" disabled={busy} onClick={() => void onApprove()}>
              확인 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>재인증 요청</DialogTitle>
            <DialogDescription>반려 사유를 선택하세요.</DialogDescription>
          </DialogHeader>
          <select
            className="flex h-9 w-full rounded-md border border-border bg-muted px-2 text-sm"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          >
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="outline"
              className="border-red-500/40 text-red-700"
              disabled={busy}
              onClick={() => void onReject()}
            >
              반려하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
