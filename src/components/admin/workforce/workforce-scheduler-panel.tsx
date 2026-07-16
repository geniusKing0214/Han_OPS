"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useEvents } from "@/hooks/use-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  subscribeAllUsersForAdmin,
  type ListedUserRow,
} from "@/lib/firestore-users";
import {
  confirmWorkforceWeek,
  createWorkforceSchedule,
  deleteWorkforceSchedule,
  duplicateWorkforceSchedule,
  ensureWeekMeta,
  exportWeekToMonthlySheet,
  importEventsForWeek,
  countPendingEventImports,
  resetWorkforceWeek,
  saveWeekDraft,
  setScheduleAssignees,
  subscribeAllAvailability,
  subscribeWorkforceSchedules,
  subscribeWorkforceWeek,
  updateWorkforceSchedule,
  upsertAvailability,
} from "@/lib/firestore-workforce";
import {
  formatDayHeader,
  formatWeekRangeLabel,
  getWeekDates,
  getWeekStartMonday,
  shiftWeek,
  yearMonthFromYmd,
} from "@/lib/workforce-dates";
import {
  computeWorkerStatus,
  countAssignmentsInWeek,
  findDuplicateSameDayPairs,
  findSameDayAssignment,
  findUnavailableAssignments,
  isUserAvailableOnDate,
  resolveAvailability,
  summarizeWeek,
} from "@/lib/workforce-logic";
import {
  notifyMemberWorkforce,
  notifyWorkforceWeekConfirmed,
} from "@/lib/firestore-notifications";
import {
  TEAM_IDS,
  TEAM_LABELS,
  normalizeTeamId,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  WORKFORCE_COLORS,
  WORKFORCE_WORKER_STATUS_LABELS,
  type WorkforceAvailability,
  type WorkforceSchedule,
  type WorkforceWeekMeta,
  type WorkforceWorkerStatus,
  type WeekdayKey,
} from "@/types/workforce";

const STATUS_DOT: Record<WorkforceWorkerStatus, string> = {
  available: "bg-emerald-400",
  partial: "bg-amber-400",
  full: "bg-sky-400",
  unavailable: "bg-red-400",
  leave: "bg-zinc-400",
};

type ScheduleFormState = {
  title: string;
  date: string;
  startTime: string;
  venue: string;
  requiredCount: number;
  teamIds: TeamId[];
  note: string;
  color: string;
};

function emptyForm(date: string): ScheduleFormState {
  return {
    title: "",
    date,
    startTime: "10:00",
    venue: "",
    requiredCount: 1,
    teamIds: [...TEAM_IDS],
    note: "",
    color: WORKFORCE_COLORS[0],
  };
}

export function WorkforceSchedulerPanel() {
  const { user, isAdmin } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { events } = useEvents();
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday());
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const [workersOpen, setWorkersOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WorkforceWorkerStatus>(
    "all",
  );
  const [members, setMembers] = useState<ListedUserRow[]>([]);
  const [availMap, setAvailMap] = useState<Map<string, WorkforceAvailability>>(
    () => new Map(),
  );
  const [schedules, setSchedules] = useState<WorkforceSchedule[]>([]);
  const [weekMeta, setWeekMeta] = useState<WorkforceWeekMeta | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(() =>
    emptyForm(weekDates[0]!),
  );
  const [assignTarget, setAssignTarget] = useState<WorkforceSchedule | null>(
    null,
  );
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const [warnReason, setWarnReason] = useState("");
  const [pendingAssign, setPendingAssign] = useState<{
    scheduleId: string;
    userIds: string[];
    reasonRequired: boolean;
  } | null>(null);
  const [availEditUser, setAvailEditUser] = useState<ListedUserRow | null>(null);
  const [menuScheduleId, setMenuScheduleId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAllUsersForAdmin(
      (rows) =>
        setMembers(
          rows.filter(
            (r) => r.accountStatus === "approved" && r.role === "member",
          ),
        ),
      (e) => setError(e.message),
    );
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAllAvailability(setAvailMap, (e) => setError(e.message));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeWorkforceSchedules(
      weekStart,
      setSchedules,
      (e) => setError(e.message),
    );
  }, [isAdmin, weekStart]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeWorkforceWeek(weekStart, setWeekMeta, (e) =>
      setError(e.message),
    );
  }, [isAdmin, weekStart]);

  useEffect(() => {
    if (!isAdmin || !user) return;
    void ensureWeekMeta(weekStart, user.uid).catch(() => {});
  }, [isAdmin, user, weekStart]);

  const nameByUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of members) {
      m.set(r.uid, r.displayName?.trim() || r.email.split("@")[0] || r.uid);
    }
    return m;
  }, [members]);

  const teamByUid = useMemo(() => {
    const m = new Map<string, TeamId>();
    for (const r of members) m.set(r.uid, normalizeTeamId(r.team_id));
    return m;
  }, [members]);

  const workers = useMemo(() => {
    return members
      .filter((m) => {
        if (teamFilter !== "all" && normalizeTeamId(m.team_id) !== teamFilter)
          return false;
        const name = (m.displayName || m.email).toLowerCase();
        if (search.trim() && !name.includes(search.trim().toLowerCase()))
          return false;
        const avail = resolveAvailability(availMap, m.uid);
        const count = countAssignmentsInWeek(schedules, m.uid);
        const status = computeWorkerStatus(avail, weekDates, count);
        if (statusFilter !== "all" && status !== statusFilter) return false;
        return true;
      })
      .map((m) => {
        const avail = resolveAvailability(availMap, m.uid);
        const count = countAssignmentsInWeek(schedules, m.uid);
        const status = computeWorkerStatus(avail, weekDates, count);
        return { member: m, avail, count, status };
      });
  }, [
    members,
    teamFilter,
    search,
    statusFilter,
    availMap,
    schedules,
    weekDates,
  ]);

  const summary = useMemo(() => summarizeWeek(schedules), [schedules]);
  const duplicates = useMemo(
    () => findDuplicateSameDayPairs(schedules),
    [schedules],
  );
  const unavailableHits = useMemo(
    () => findUnavailableAssignments(schedules, availMap),
    [schedules, availMap],
  );
  const pendingEventImports = useMemo(
    () => countPendingEventImports(weekDates, events, schedules),
    [weekDates, events, schedules],
  );
  const unassignedWorkers = useMemo(
    () =>
      members.filter(
        (m) =>
          (teamFilter === "all" || normalizeTeamId(m.team_id) === teamFilter) &&
          countAssignmentsInWeek(schedules, m.uid) === 0,
      ).length,
    [members, schedules, teamFilter],
  );

  const tryAssign = async (
    schedule: WorkforceSchedule,
    userIds: string[],
    opts?: { force?: boolean; reason?: string },
  ) => {
    setError("");
    const warnings: string[] = [];
    let reasonRequired = false;

    for (const uid of userIds) {
      const name = nameByUid.get(uid) || uid;
      const avail = resolveAvailability(availMap, uid);
      const sameDay = findSameDayAssignment(
        schedules,
        uid,
        schedule.date,
        schedule.id,
      );
      if (sameDay) {
        warnings.push(
          `${name}: 같은 날「${sameDay.title}」에 이미 배정되어 있습니다.`,
        );
        reasonRequired = true;
      }
      if (!isUserAvailableOnDate(avail, schedule.date)) {
        warnings.push(`${name}: 근무 불가일로 설정된 날입니다.`);
        reasonRequired = true;
      }
      const count = countAssignmentsInWeek(schedules, uid);
      const alreadyHere = schedule.assignedUserIds.includes(uid);
      const nextCount = alreadyHere ? count : count + 1;
      if (nextCount > avail.weeklyMaxAssignments) {
        warnings.push(
          `${name}: 주간 최대 배정(${avail.weeklyMaxAssignments}회)을 초과합니다.`,
        );
        reasonRequired = true;
      }
    }

    if (warnings.length > 0 && !opts?.force) {
      setWarnMessage(warnings.join("\n"));
      setWarnReason("");
      setPendingAssign({
        scheduleId: schedule.id,
        userIds,
        reasonRequired,
      });
      setWarnOpen(true);
      return;
    }

    if (reasonRequired && !opts?.reason?.trim()) {
      setError("예외 배정 사유를 입력해 주세요.");
      return;
    }

    const next = [...new Set([...schedule.assignedUserIds, ...userIds])];
    setBusy(true);
    try {
      await setScheduleAssignees(schedule.id, next, {
        action: "assign",
        targetUserId: userIds[0],
        targetUserName: nameByUid.get(userIds[0]!),
        reason: opts?.reason,
        detail: schedule.title,
      });
      if (weekMeta?.status === "confirmed" && user) {
        for (const uid of userIds) {
          await notifyMemberWorkforce({
            targetUserId: uid,
            createdByUserId: user.uid,
            type: "workforce_updated",
            title: "근무 배정이 변경되었습니다",
            message: `${schedule.date} ${schedule.title} 일정에 배정되었습니다.`,
            eventTitle: schedule.title,
            eventDate: schedule.date,
            slotTime: schedule.startTime,
            location: schedule.venue,
            scheduleId: schedule.id,
          });
        }
      }
      setSelectedWorkerIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "배정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const removeAssignee = async (schedule: WorkforceSchedule, uid: string) => {
    setBusy(true);
    try {
      await setScheduleAssignees(
        schedule.id,
        schedule.assignedUserIds.filter((id) => id !== uid),
        {
          action: "unassign",
          targetUserId: uid,
          targetUserName: nameByUid.get(uid),
          detail: schedule.title,
        },
      );
      if (weekMeta?.status === "confirmed" && user) {
        await notifyMemberWorkforce({
          targetUserId: uid,
          createdByUserId: user.uid,
          type: "workforce_cancelled",
          title: "근무 배정이 취소되었습니다",
          message: `${schedule.date} ${schedule.title} 배정이 취소되었습니다.`,
          eventTitle: schedule.title,
          eventDate: schedule.date,
          slotTime: schedule.startTime,
          location: schedule.venue,
          scheduleId: schedule.id,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "해제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (date: string) => {
    setEditingId(null);
    setForm(emptyForm(date));
    setFormOpen(true);
  };

  const openEdit = (s: WorkforceSchedule) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      venue: s.venue,
      requiredCount: s.requiredCount,
      teamIds: s.teamIds,
      note: s.note,
      color: s.color,
    });
    setFormOpen(true);
    setMenuScheduleId(null);
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      setError("일정명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        const prev = schedules.find((s) => s.id === editingId);
        await updateWorkforceSchedule(editingId, {
          title: form.title,
          date: form.date,
          startTime: form.startTime,
          venue: form.venue,
          requiredCount: form.requiredCount,
          teamIds: form.teamIds,
          note: form.note,
          color: form.color,
        });
        if (weekMeta?.status === "confirmed" && prev && user) {
          const timeChanged = prev.startTime !== form.startTime;
          const venueChanged = prev.venue !== form.venue;
          if (timeChanged || venueChanged) {
            for (const uid of prev.assignedUserIds) {
              await notifyMemberWorkforce({
                targetUserId: uid,
                createdByUserId: user.uid,
                type: "workforce_updated",
                title: timeChanged
                  ? "출근 시간이 변경되었습니다"
                  : "근무 장소가 변경되었습니다",
                message: `${form.date} ${form.title}: ${form.startTime} / ${form.venue}`,
                eventTitle: form.title,
                eventDate: form.date,
                slotTime: form.startTime,
                location: form.venue,
                scheduleId: editingId,
              });
            }
          }
        }
      } else {
        await createWorkforceSchedule({
          weekStart,
          ...form,
        });
      }
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        관리자만 인력 배정 스케줄러를 사용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">인력 배정 스케줄러</CardTitle>
              <CardDescription>
                관리자가 주간 단위로 근무자를 직접 배정합니다. (신청 시스템과
                별도)
              </CardDescription>
            </div>
            <Badge
              variant={
                weekMeta?.status === "confirmed" ? "success" : "warning"
              }
            >
              {weekMeta?.status === "confirmed" ? "확정" : "임시"}
            </Badge>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[220px] text-center text-sm tabular-nums">
                {formatWeekRangeLabel(weekStart)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={teamFilter}
              onChange={(e) =>
                setTeamFilter(e.target.value as TeamFilterValue)
              }
            >
              <option value="all">전체 팀</option>
              {TEAM_IDS.map((id) => (
                <option key={id} value={id}>
                  {TEAM_LABELS[id]}
                </option>
              ))}
            </select>
            <Input
              placeholder="근무자·일정 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || pendingEventImports === 0}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const { imported, skipped } = await importEventsForWeek({
                        weekStart,
                        weekDates,
                        events,
                        existing: schedules,
                      });
                      alert(
                        `스케줄에서 ${imported}개 슬롯을 가져왔습니다.` +
                          (skipped > 0
                            ? ` (이미 연결된 ${skipped}개는 건너뜀)`
                            : ""),
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "스케줄 불러오기에 실패했습니다.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                스케줄에서 불러오기
                {pendingEventImports > 0 ? ` (${pendingEventImports})` : ""}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      await saveWeekDraft(weekStart);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "임시저장 실패",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                임시저장
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (
                      !confirm(
                        "주간 배정을 확정하면 배정된 유저에게 공개·알림됩니다. 계속할까요?",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const { schedules: confirmed } =
                        await confirmWorkforceWeek(weekStart);
                      if (user) {
                        await notifyWorkforceWeekConfirmed({
                          createdByUserId: user.uid,
                          schedules: confirmed,
                        });
                      }
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "확정에 실패했습니다.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                주간 배정 확정
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (
                      !confirm(
                        "이번 주 일정·배정을 모두 삭제합니다. 계속할까요?",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      await resetWorkforceWeek(weekStart);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "초기화 실패",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                전체 초기화
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || schedules.length === 0}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const id = await exportWeekToMonthlySheet({
                        weekStart,
                        schedules,
                        nameByUid,
                        teamByUid,
                        yearMonth: yearMonthFromYmd(weekStart),
                      });
                      alert(
                        `취합표 전달 데이터를 저장했습니다. (export: ${id.slice(0, 8)}…)`,
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "취합표 전달 실패",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                취합표로 보내기
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          workersOpen
            ? "lg:grid-cols-[280px_minmax(0,1fr)]"
            : "lg:grid-cols-1",
        )}
      >
        {/* Worker list — 기본 접힘 */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-between gap-2 lg:w-auto"
            onClick={() => setWorkersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2">
              <Users className="size-3.5" />
              근무자 목록
              {selectedWorkerIds.length > 0
                ? ` (선택 ${selectedWorkerIds.length})`
                : ""}
            </span>
            {workersOpen ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>

          {workersOpen ? (
        <Card className="lg:max-h-[calc(100dvh-220px)] lg:overflow-hidden">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-sm">근무자 목록</CardTitle>
            <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              {(
                Object.keys(WORKFORCE_WORKER_STATUS_LABELS) as WorkforceWorkerStatus[]
              ).map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[k])} />
                  {WORKFORCE_WORKER_STATUS_LABELS[k]}
                </span>
              ))}
            </div>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
            >
              <option value="all">상태 전체</option>
              {(
                Object.keys(WORKFORCE_WORKER_STATUS_LABELS) as WorkforceWorkerStatus[]
              ).map((k) => (
                <option key={k} value={k}>
                  {WORKFORCE_WORKER_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto pb-4 lg:max-h-[calc(100dvh-340px)]">
            {workers.map(({ member, avail, count, status }) => {
              const selected = selectedWorkerIds.includes(member.uid);
              return (
                <div
                  key={member.uid}
                  draggable={isDesktop}
                  onDragStart={() => setDragUserId(member.uid)}
                  onDragEnd={() => setDragUserId(null)}
                  className={cn(
                    "rounded-xl border border-border bg-muted/30 p-3 transition-colors",
                    selected && "border-accent/50 bg-accent/10",
                    isDesktop && "cursor-grab active:cursor-grabbing",
                  )}
                  onClick={() => {
                    setSelectedWorkerIds((prev) =>
                      prev.includes(member.uid)
                        ? prev.filter((id) => id !== member.uid)
                        : [...prev, member.uid],
                    );
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {nameByUid.get(member.uid)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          | {TEAM_LABELS[normalizeTeamId(member.team_id)]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        이번주 {count}회 / 최대 {avail.weeklyMaxAssignments}회
                      </p>
                    </div>
                    <span
                      className={cn("mt-1 size-2 shrink-0 rounded-full", STATUS_DOT[status])}
                      title={WORKFORCE_WORKER_STATUS_LABELS[status]}
                    />
                  </div>
                  <div className="mt-2 flex gap-1">
                    {WEEKDAY_KEYS.map((k, i) => {
                      const date = weekDates[i]!;
                      const on = isUserAvailableOnDate(avail, date);
                      return (
                        <span
                          key={k}
                          className={cn(
                            "flex size-6 items-center justify-center rounded text-[10px] font-medium",
                            on
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-muted text-muted-foreground",
                          )}
                          title={`${WEEKDAY_LABELS[k]} ${date}`}
                        >
                          {WEEKDAY_SHORT[k]}
                        </span>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-0 text-[11px] text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAvailEditUser(member);
                    }}
                  >
                    가능일·최대횟수 설정
                  </Button>
                </div>
              );
            })}
            {workers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                조건에 맞는 근무자가 없습니다.
              </p>
            ) : null}
          </CardContent>
        </Card>
          ) : null}
        </div>

        {/* Week calendar */}
        <div className="min-w-0 space-y-3 overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const daySchedules = schedules.filter((s) => s.date === date);
              const dayRequired = daySchedules.reduce(
                (a, s) => a + s.requiredCount,
                0,
              );
              const dayAssigned = daySchedules.reduce(
                (a, s) => a + s.assignedUserIds.length,
                0,
              );
              const diff = dayAssigned - dayRequired;
              const { label, dow } = formatDayHeader(date);
              return (
                <div
                  key={date}
                  className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card/60"
                  onDragOver={(e) => {
                    if (isDesktop) e.preventDefault();
                  }}
                >
                  <div className="border-b border-border px-2 py-2">
                    <p className="text-center text-xs font-semibold">
                      {dow}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {label}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-center text-[10px]",
                        diff < 0
                          ? "text-red-300"
                          : diff > 0
                            ? "text-sky-300"
                            : "text-emerald-300",
                      )}
                    >
                      필요 {dayRequired} · 배정 {dayAssigned} ·{" "}
                      {diff < 0
                        ? `부족 ${-diff}`
                        : diff > 0
                          ? `초과 ${diff}`
                          : "충족"}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full gap-1 text-[11px]"
                      onClick={() => openCreate(date)}
                    >
                      <Plus className="size-3" /> 일정 추가
                    </Button>
                    {daySchedules.map((s) => (
                      <ScheduleCard
                        key={s.id}
                        schedule={s}
                        nameByUid={nameByUid}
                        menuOpen={menuScheduleId === s.id}
                        onMenuToggle={() =>
                          setMenuScheduleId((id) =>
                            id === s.id ? null : s.id,
                          )
                        }
                        onEdit={() => openEdit(s)}
                        onDuplicate={() =>
                          void duplicateWorkforceSchedule(s.id)
                        }
                        onDelete={() =>
                          void (async () => {
                            if (!confirm("이 일정을 삭제할까요?")) return;
                            await deleteWorkforceSchedule(s.id);
                          })()
                        }
                        onDropWorker={() => {
                          if (!dragUserId) return;
                          void tryAssign(s, [dragUserId]);
                          setDragUserId(null);
                        }}
                        onClickAssign={() => {
                          if (selectedWorkerIds.length > 0) {
                            void tryAssign(s, selectedWorkerIds);
                            return;
                          }
                          setAssignTarget(s);
                        }}
                        onRemoveUser={(uid) => void removeAssignee(s, uid)}
                        isDesktop={isDesktop}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer summary */}
      <Card>
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryStat label="총 필요 인원" value={summary.required} />
          <SummaryStat label="총 배정 인원" value={summary.assigned} />
          <SummaryStat label="부족 인원" value={summary.shortage} danger />
          <SummaryStat label="초과 인원" value={summary.excess} />
          <SummaryStat label="배정 안된 인원" value={unassignedWorkers} />
          <SummaryStat label="중복 배정" value={duplicates.length} danger />
          <SummaryStat
            label="근무 불가일 배정"
            value={unavailableHits.length}
            danger
          />
        </CardContent>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          근무자 목록은 기본 접힘 — 상단 «근무자 목록»으로 펼칩니다. «스케줄에서
          불러오기»로 Admin 일정의 이벤트·슬롯을 가져올 수 있습니다. PC: 드래그
          배정 · 클릭 선택 후 일정 탭.
        </p>
      </Card>

      {/* Schedule form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "일정 수정" : "일정 추가"}
            </DialogTitle>
            <DialogDescription>
              포지션 없이 일정 단위로 필요 인원과 배정자를 관리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="일정명">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="날짜">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </Field>
              <Field label="출근시간">
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startTime: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="근무 장소">
              <Input
                value={form.venue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, venue: e.target.value }))
                }
              />
            </Field>
            <Field label="필요 인원">
              <Input
                type="number"
                min={0}
                value={form.requiredCount}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    requiredCount: Number(e.target.value) || 0,
                  }))
                }
              />
            </Field>
            <Field label="대상 팀">
              <div className="flex gap-3 text-sm">
                {TEAM_IDS.map((id) => (
                  <label key={id} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.teamIds.includes(id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          teamIds: e.target.checked
                            ? [...f.teamIds, id]
                            : f.teamIds.filter((t) => t !== id),
                        }));
                      }}
                    />
                    {TEAM_LABELS[id]}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="특이사항">
              <Textarea
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </Field>
            <Field label="색상">
              <div className="flex flex-wrap gap-2">
                {WORKFORCE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "size-7 rounded-full border-2",
                      form.color === c ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={busy}
              onClick={() => void submitForm()}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning / force assign */}
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>배정 경고</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">
              {warnMessage}
            </DialogDescription>
          </DialogHeader>
          {pendingAssign?.reasonRequired ? (
            <Textarea
              placeholder="예외 배정 사유 (필수)"
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWarnOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  if (!pendingAssign) return;
                  const s = schedules.find(
                    (x) => x.id === pendingAssign.scheduleId,
                  );
                  if (!s) return;
                  setWarnOpen(false);
                  await tryAssign(s, pendingAssign.userIds, {
                    force: true,
                    reason: warnReason,
                  });
                  setPendingAssign(null);
                })()
              }
            >
              강제 배정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click assign picker (mobile / no selection) */}
      <Dialog
        open={!!assignTarget}
        onOpenChange={(o) => {
          if (!o) setAssignTarget(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>근무자 배정</DialogTitle>
            <DialogDescription>
              {assignTarget
                ? `${assignTarget.date} ${assignTarget.title}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {workers.map(({ member, status }) => (
              <button
                key={member.uid}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => {
                  if (!assignTarget) return;
                  void tryAssign(assignTarget, [member.uid]);
                  setAssignTarget(null);
                }}
              >
                <span>
                  {nameByUid.get(member.uid)} ·{" "}
                  {TEAM_LABELS[normalizeTeamId(member.team_id)]}
                </span>
                <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Availability editor */}
      <AvailabilityDialog
        member={availEditUser}
        avail={
          availEditUser
            ? resolveAvailability(availMap, availEditUser.uid)
            : null
        }
        weekDates={weekDates}
        onClose={() => setAvailEditUser(null)}
        onSave={async (patch) => {
          if (!availEditUser) return;
          await upsertAvailability(availEditUser.uid, patch);
          setAvailEditUser(null);
        }}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          danger && value > 0 && "text-red-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ScheduleCard({
  schedule,
  nameByUid,
  menuOpen,
  onMenuToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onDropWorker,
  onClickAssign,
  onRemoveUser,
  isDesktop,
}: {
  schedule: WorkforceSchedule;
  nameByUid: Map<string, string>;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDropWorker: () => void;
  onClickAssign: () => void;
  onRemoveUser: (uid: string) => void;
  isDesktop: boolean;
}) {
  const shown = schedule.assignedUserIds.slice(0, 3);
  const more = schedule.assignedUserIds.length - shown.length;
  const filled = schedule.assignedUserIds.length;
  return (
    <div
      className="relative rounded-xl border border-border bg-background/70 p-2.5 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: schedule.color }}
      onDragOver={(e) => {
        if (isDesktop) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropWorker();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <span
            className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: schedule.color }}
          >
            {schedule.startTime}
          </span>
          <p className="mt-1 truncate text-xs font-semibold">{schedule.title}</p>
          {schedule.sourceEventId ? (
            <p className="mt-0.5 text-[9px] font-medium text-sky-300/90">
              스케줄 연동
            </p>
          ) : null}
          <p className="truncate text-[10px] text-muted-foreground">
            {schedule.venue || "장소 미정"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            필요 {schedule.requiredCount} · 배정 {filled}
          </p>
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onMenuToggle}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-28 rounded-md border border-border bg-card py-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                onClick={onEdit}
              >
                <Pencil className="size-3" /> 수정
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                onClick={onDuplicate}
              >
                <Copy className="size-3" /> 복제
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-300 hover:bg-muted"
                onClick={onDelete}
              >
                <Trash2 className="size-3" /> 삭제
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {shown.map((uid) => (
          <div
            key={uid}
            className="flex items-center justify-between rounded bg-muted/40 px-1.5 py-0.5 text-[10px]"
          >
            <span className="truncate">{nameByUid.get(uid) || uid}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-red-300"
              onClick={() => onRemoveUser(uid)}
            >
              ×
            </button>
          </div>
        ))}
        {more > 0 ? (
          <p className="text-[10px] text-muted-foreground">+{more} more</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-7 w-full gap-1 text-[10px]"
        onClick={onClickAssign}
      >
        <Users className="size-3" /> 배정
      </Button>
    </div>
  );
}

function AvailabilityDialog({
  member,
  avail,
  weekDates,
  onClose,
  onSave,
}: {
  member: ListedUserRow | null;
  avail: WorkforceAvailability | null;
  weekDates: string[];
  onClose: () => void;
  onSave: (patch: {
    weeklyMaxAssignments: number;
    availableWeekdays: Record<WeekdayKey, boolean>;
    dateExceptions: Record<string, "available" | "unavailable">;
  }) => Promise<void>;
}) {
  const [max, setMax] = useState(5);
  const [weekdays, setWeekdays] = useState<Record<WeekdayKey, boolean>>({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  });
  const [exceptions, setExceptions] = useState<
    Record<string, "available" | "unavailable">
  >({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avail) return;
    setMax(avail.weeklyMaxAssignments);
    setWeekdays({ ...avail.availableWeekdays });
    setExceptions({ ...avail.dateExceptions });
  }, [avail]);

  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>근무 가능 설정</DialogTitle>
          <DialogDescription>
            {member
              ? `${member.displayName || member.email} · 기본 요일 + 이번 주 예외`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <Field label="주간 최대 배정">
          <Input
            type="number"
            min={0}
            value={max}
            onChange={(e) => setMax(Number(e.target.value) || 0)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_KEYS.map((k) => (
            <label
              key={k}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={weekdays[k]}
                onChange={(e) =>
                  setWeekdays((w) => ({ ...w, [k]: e.target.checked }))
                }
              />
              {WEEKDAY_LABELS[k]}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">이번 주 날짜 예외</p>
          {weekDates.map((d) => (
            <div
              key={d}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="tabular-nums">{d}</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2"
                value={exceptions[d] || "default"}
                onChange={(e) => {
                  const v = e.target.value;
                  setExceptions((prev) => {
                    const next = { ...prev };
                    if (v === "default") delete next[d];
                    else next[d] = v as "available" | "unavailable";
                    return next;
                  });
                }}
              >
                <option value="default">기본</option>
                <option value="available">가능</option>
                <option value="unavailable">불가</option>
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await onSave({
                    weeklyMaxAssignments: max,
                    availableWeekdays: weekdays,
                    dateExceptions: exceptions,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
