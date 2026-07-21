"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronUp, Users } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import {
  applicationsForSlot,
  countApplicationsByStatus,
  eventsWithSessionsOnDate,
  formatSlotTimeLabel,
  formatSubmittedAt,
  slotKey,
} from "@/lib/admin-application-roster";
import { ApplicationWorkActions } from "@/components/admin/application-work-actions";
import {
  decideApplication,
  updateApplicationAdminMemo,
} from "@/lib/firestore-applications";
import { setApplicationWorkStatus } from "@/lib/firestore-points";
import type { WorkStatus } from "@/types/points";
import { getUserProfilesByIds } from "@/lib/firestore-users";
import { useAdminApplicationsByDate } from "@/hooks/use-admin-applications-by-date";
import { useEvents } from "@/hooks/use-events";
import type { ApplicationItem } from "@/types/application";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { EventItem, Session, Slot } from "@/types/schedule";
import { subscribeAttendancesByWorkDate, pickLatestAttendance } from "@/lib/firestore-attendance";
import {
  LOCATION_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  TIME_STATUS_LABELS,
  type AttendanceRecord,
} from "@/types/attendance";
import { formatAttendanceDateTime } from "@/lib/attendance-window";
import { cn } from "@/lib/utils";
import Link from "next/link";

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftDateYmd(ymd: string, days: number): string {
  const next = ymdToDate(ymd);
  next.setDate(next.getDate() + days);
  return toYmd(next);
}

function resolveName(a: ApplicationItem, profiles: Map<string, { displayName: string }>) {
  const nick = a.applicantDisplayName?.trim();
  if (nick) return nick;
  const p = a.userId ? profiles.get(a.userId) : undefined;
  return p?.displayName?.trim() || "—";
}

function resolveEmail(a: ApplicationItem, profiles: Map<string, { email: string }>) {
  const direct = a.applicantEmail?.trim();
  if (direct) return direct;
  const p = a.userId ? profiles.get(a.userId) : undefined;
  return p?.email?.trim() || "—";
}

function adminMemoDisplay(a: ApplicationItem): string {
  const parts: string[] = [];
  if (a.adminMemo?.trim()) parts.push(a.adminMemo.trim());
  if (a.rejectionReason?.trim()) parts.push(`[거절] ${a.rejectionReason.trim()}`);
  if (a.note?.trim()) parts.push(`[신청] ${a.note.trim()}`);
  return parts.join(" · ") || "—";
}

type SlotRosterProps = {
  event: EventItem;
  session: Session;
  slot: Slot;
  applications: ApplicationItem[];
  profiles: Map<string, { email: string; displayName: string }>;
  attendances: AttendanceRecord[];
  expanded: boolean;
  onToggle: () => void;
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (app: ApplicationItem) => void;
  onWorkStatus: (id: string, status: WorkStatus) => void;
  onMemoBlur: (id: string, memo: string) => void;
  highlightApplicationId?: string | null;
};

function SlotRosterRow({
  event,
  session,
  slot,
  applications,
  profiles,
  attendances,
  expanded,
  onToggle,
  busyId,
  onApprove,
  onReject,
  onWorkStatus,
  onMemoBlur,
  highlightApplicationId,
}: SlotRosterProps) {
  const slotApps = useMemo(
    () => applicationsForSlot(applications, event.id, session.id, slot.id),
    [applications, event.id, session.id, slot.id],
  );
  const counts = useMemo(() => countApplicationsByStatus(slotApps), [slotApps]);
  const timeLabel = formatSlotTimeLabel(slot);

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium tabular-nums">{timeLabel}</p>
          <p className="text-xs text-muted-foreground">
            정원 {slot.capacity}명 / 신청 {counts.total}명 / 승인 {counts.approved}명 /
            대기 {counts.pending}명 / 거절 {counts.rejected}명
            {counts.completed > 0 ? ` / 완료 ${counts.completed}명` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onToggle}
        >
          <Users className="size-3.5" />
          신청자 보기
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-border px-3 pb-3">
          {slotApps.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              이 슬롯에 신청자가 없습니다.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pt-3">
              {slotApps.map((a) => (
                <div
                  key={a.id}
                  id={`roster-app-${a.id}`}
                  className={cn(
                    "rounded-md border border-border bg-background/60 px-3 py-2.5",
                    highlightApplicationId === a.id &&
                      "border-accent/50 bg-accent/10 ring-1 ring-accent/30",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">
                        {resolveName(a, profiles)}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        {resolveEmail(a, profiles)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        신청 {formatSubmittedAt(a.submittedAt)}
                      </p>
                      {a.positionLabel ? (
                        <p className="text-xs text-muted-foreground">
                          포지션:{" "}
                          <span className="font-medium text-foreground">{a.positionLabel}</span>
                          {a.positionSlotTime ? (
                            <span className="ml-1 tabular-nums text-accent">· {a.positionSlotTime}</span>
                          ) : null}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">메모</span>{" "}
                        {adminMemoDisplay(a)}
                      </p>
                      {(() => {
                        const att = pickLatestAttendance(attendances, a.id);
                        const attendanceOn =
                          event.attendance?.attendanceEnabled === true;
                        if (!attendanceOn) return null;
                        if (!att) {
                          return (
                            <p className="text-xs text-amber-300/90">
                              출근 인증 미완료
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>
                              인증{" "}
                              {att.actualCheckInAt
                                ? formatAttendanceDateTime(att.actualCheckInAt)
                                : "—"}{" "}
                              · {TIME_STATUS_LABELS[att.timeStatus]}
                            </p>
                            <p>
                              {LOCATION_STATUS_LABELS[att.locationStatus]}
                              {att.distanceFromVenueMeters != null
                                ? ` · ${att.distanceFromVenueMeters}m`
                                : ""}{" "}
                              · {REVIEW_STATUS_LABELS[att.reviewStatus]}
                            </p>
                            <Link
                              href="/admin/attendance"
                              className="text-accent hover:underline"
                            >
                              인증 상세 보기
                            </Link>
                          </div>
                        );
                      })()}
                    </div>
                    <ApplicationWorkActions
                      application={a}
                      busy={busyId === a.id}
                      onApprove={() => onApprove(a.id)}
                      onReject={() => onReject(a)}
                      onWorkStatus={(ws) => onWorkStatus(a.id, ws)}
                    />
                  </div>
                  <div className="mt-2">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      관리자 메모
                    </label>
                    <Textarea
                      key={`${a.id}-${a.adminMemo ?? ""}`}
                      className="mt-1 min-h-[52px] text-xs"
                      defaultValue={a.adminMemo ?? ""}
                      placeholder="관리자 메모 (저장: 포커스 아웃)"
                      onBlur={(e) => onMemoBlur(a.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ApplicationRosterPanel() {
  const { isAdmin, user } = useAuth();
  const searchParams = useSearchParams();
  const focusAppId = searchParams.get("app");
  const focusEventId = searchParams.get("event");
  const focusSlotTime = searchParams.get("slot");
  const dateParam = searchParams.get("date");
  const [date, setDate] = useState(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return toYmd(new Date());
  });
  const { events, loading: eventsLoading, error: eventsError } = useEvents();
  const { items: applications, loading: appsLoading, error: appsError } =
    useAdminApplicationsByDate(date);

  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [profiles, setProfiles] = useState<
    Map<string, { email: string; displayName: string }>
  >(() => new Map());
  const [rejectTarget, setRejectTarget] = useState<ApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const scrolledToApp = useRef(false);

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setDate(dateParam);
    }
  }, [dateParam]);

  useEffect(() => {
    if (!focusEventId) return;
    setExpandedEvents((prev) => ({ ...prev, [focusEventId]: true }));
  }, [focusEventId]);

  useEffect(() => {
    return subscribeAttendancesByWorkDate(date, setAttendances);
  }, [date]);

  const eventRows = useMemo(
    () => eventsWithSessionsOnDate(events, date),
    [events, date],
  );

  const userIdsKey = useMemo(() => {
    const ids = [
      ...new Set(
        applications
          .map((a) => a.userId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return ids.sort().join("|");
  }, [applications]);

  useEffect(() => {
    if (!isAdmin) return;
    const ids = userIdsKey ? userIdsKey.split("|").filter(Boolean) : [];
    if (ids.length === 0) {
      setProfiles(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const m = await getUserProfilesByIds(ids);
        if (!cancelled) setProfiles(m);
      } catch {
        if (!cancelled) setProfiles(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userIdsKey, isAdmin]);

  const loading = eventsLoading || appsLoading;
  const error = eventsError || appsError;

  useEffect(() => {
    if (!focusEventId || !focusSlotTime || eventRows.length === 0) return;
    for (const { event, sessions } of eventRows) {
      if (event.id !== focusEventId) continue;
      for (const session of sessions) {
        for (const slot of session.slots) {
          const label = formatSlotTimeLabel(slot);
          if (
            label === focusSlotTime ||
            slot.start_time.trim() === focusSlotTime
          ) {
            const key = slotKey(event.id, session.id, slot.id);
            setExpandedSlots((prev) => ({ ...prev, [key]: true }));
          }
        }
      }
    }
  }, [focusEventId, focusSlotTime, eventRows]);

  useEffect(() => {
    if (!focusAppId || scrolledToApp.current || loading) return;
    const el = document.getElementById(`roster-app-${focusAppId}`);
    if (!el) return;
    scrolledToApp.current = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusAppId, loading, applications, expandedSlots]);

  const setStatus = async (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ) => {
    setLocalError("");
    setBusyId(id);
    try {
      await decideApplication(id, status, {
        rejectionReason: rejectionReason?.trim() || undefined,
      });
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "처리에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleWorkStatus = async (id: string, workStatus: WorkStatus) => {
    if (!user) return;
    setLocalError("");
    setBusyId(id);
    try {
      await setApplicationWorkStatus(id, workStatus, user.uid);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "근무 처리에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMemoBlur = async (id: string, memo: string) => {
    setLocalError("");
    try {
      await updateApplicationAdminMemo(id, memo);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "메모 저장에 실패했습니다.",
      );
    }
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const toggleSlot = (key: string) => {
    setExpandedSlots((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        관리자만 이 화면을 볼 수 있습니다.
      </p>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">신청 인원 관리</CardTitle>
          <CardDescription>
            날짜별 이벤트·슬롯 신청 현황과 신청자 목록을 확인합니다. (관리자 전용)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="text-sm font-medium text-muted-foreground">
              날짜
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="max-w-[200px] tabular-nums"
              />
              <div className="flex flex-col gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7"
                  aria-label="다음 날"
                  onClick={() => setDate((prev) => shiftDateYmd(prev, 1))}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7"
                  aria-label="이전 날"
                  onClick={() => setDate((prev) => shiftDateYmd(prev, -1))}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {error}
            </p>
          ) : null}
          {localError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {localError}
            </p>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              불러오는 중...
            </p>
          ) : eventRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              선택한 날짜에 등록된 일정(이벤트)이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {eventRows.map(({ event, sessions }) => {
                const eventOpen = expandedEvents[event.id] ?? true;
                return (
                  <Card key={event.id} className="border-border/80 bg-muted/30">
                    <CardHeader className="cursor-pointer space-y-0 p-4 pb-2">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 text-left"
                        onClick={() => toggleEvent(event.id)}
                      >
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {event.title}
                          </CardTitle>
                          <CardDescription className="mt-0.5">
                            {event.venue}
                          </CardDescription>
                        </div>
                        {eventOpen ? (
                          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </CardHeader>
                    {eventOpen ? (
                      <CardContent className="space-y-4 px-4 pb-4 pt-0">
                        {sessions.map((session) => (
                          <div key={session.id} className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              세션 · {session.date}
                            </p>
                            <div className="space-y-2">
                              {session.slots.map((slot) => {
                                const key = slotKey(event.id, session.id, slot.id);
                                return (
                                  <SlotRosterRow
                                    key={key}
                                    event={event}
                                    session={session}
                                    slot={slot}
                                    applications={applications}
                                    profiles={profiles}
                                    attendances={attendances}
                                    expanded={!!expandedSlots[key]}
                                    onToggle={() => toggleSlot(key)}
                                    busyId={busyId}
                                    onApprove={(id) => void setStatus(id, "approved")}
                                    onReject={setRejectTarget}
                                    onWorkStatus={(id, ws) =>
                                      void handleWorkStatus(id, ws)
                                    }
                                    onMemoBlur={(id, memo) =>
                                      void handleMemoBlur(id, memo)
                                    }
                                    highlightApplicationId={focusAppId}
                                  />
                                );
                              })}
                              {session.slots.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  슬롯이 없습니다.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신청 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력하면 신청자 알림·관리자 메모에 반영됩니다. (선택)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="거절 사유 (선택)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={busyId === rejectTarget?.id}
              onClick={() => {
                if (!rejectTarget) return;
                void setStatus(rejectTarget.id, "rejected", rejectReason).then(
                  () => {
                    setRejectTarget(null);
                    setRejectReason("");
                  },
                );
              }}
            >
              거절 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
