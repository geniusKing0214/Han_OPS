"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
  X,
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
  subscribeAllUsersForWorkforce,
  type ListedUserRow,
} from "@/lib/firestore-users";
import {
  confirmWorkforceWeek,
  createWorkforceSchedule,
  deleteWorkforceSchedule,
  deleteSchedulesInMonth,
  ensureWeekMeta,
  importEventsForWeek,
  countPendingEventImports,
  hasDuplicateSessionSchedules,
  mergeWeekSchedulesWithEvents,
  ensureWorkforceSchedulePersisted,
  resetWorkforceWeek,
  saveWeekDraft,
  setScheduleAssignees,
  subscribeAllAvailability,
  subscribeWorkforceSchedulesMulti,
  subscribeWorkforceWeek,
  updateWorkforceSchedule,
  upsertAvailability,
} from "@/lib/firestore-workforce";
import {
  buildCalendarWeeks,
  formatDayHeader,
  formatRangeLabel,
  getRangeDates,
  getWeekDates,
  getWeekStartMonday,
  getWeekStartsCoveringDates,
  normalizeRangeCursor,
  parseYmd,
  shiftRangeCursor,
  toYmd,
  weekdayKeyFromYmd,
  yearMonthFromYmd,
  type WorkforceRangeSpan,
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
  full: "bg-accent",
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

export function WorkforceSchedulerPanel({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const { user, isAdmin } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { events, loading: eventsLoading } = useEvents();
  const [cursor, setCursor] = useState(() => getWeekStartMonday());
  const [rangeSpan, setRangeSpan] = useState<WorkforceRangeSpan>("1w");
  const [boardLayout, setBoardLayout] = useState<"columns" | "calendar">(
    "columns",
  );
  const weekDates = useMemo(
    () => getRangeDates(cursor, rangeSpan),
    [cursor, rangeSpan],
  );
  const chipWeekDates = useMemo(
    () => getWeekDates(getWeekStartMonday(parseYmd(cursor))),
    [cursor],
  );
  const weekStarts = useMemo(
    () => getWeekStartsCoveringDates(weekDates),
    [weekDates],
  );
  const weekStartsKey = weekStarts.join(",");
  const primaryWeekStart = weekStarts[0] ?? getWeekStartMonday(parseYmd(cursor));
  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(weekDates),
    [weekDates],
  );
  const [workersOpen, setWorkersOpen] = useState(true);
  const autoSyncRef = useRef<string>("");
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
  const schedulesRef = useRef<WorkforceSchedule[]>([]);
  schedulesRef.current = schedules;
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

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAllUsersForWorkforce(
      (rows) =>
        setMembers(
          rows.filter((r) => r.accountStatus === "approved" || r.role === "admin"),
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
    return subscribeWorkforceSchedulesMulti(
      weekStarts,
      setSchedules,
      (e) => setError(e.message),
    );
  }, [isAdmin, weekStartsKey, weekStarts]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeWorkforceWeek(primaryWeekStart, setWeekMeta, (e) =>
      setError(e.message),
    );
  }, [isAdmin, primaryWeekStart]);

  useEffect(() => {
    if (!isAdmin || !user) return;
    for (const ws of weekStarts) {
      void ensureWeekMeta(ws, user.uid).catch(() => {});
    }
  }, [isAdmin, user, weekStartsKey, weekStarts]);

  const displaySchedules = useMemo(
    () =>
      mergeWeekSchedulesWithEvents(
        primaryWeekStart,
        weekDates,
        events ?? [],
        schedules,
      ),
    [primaryWeekStart, weekDates, events, schedules],
  );

  const pendingEventImports = useMemo(
    () => countPendingEventImports(weekDates, events ?? [], schedules),
    [weekDates, events, schedules],
  );

  const needsSessionCleanup = useMemo(
    () => hasDuplicateSessionSchedules(schedules),
    [schedules],
  );

  /** 범위 변경·스케줄 로드 시 이벤트 자동 동기화 + 슬롯 중복 정리 */
  useEffect(() => {
    if (!isAdmin || eventsLoading) return;
    if (pendingEventImports <= 0 && !needsSessionCleanup) return;
    const syncKey = `${weekStartsKey}:i${pendingEventImports}:c${needsSessionCleanup ? 1 : 0}`;
    if (autoSyncRef.current === syncKey) return;
    autoSyncRef.current = syncKey;
    void (async () => {
      try {
        const current = schedulesRef.current;
        for (const ws of weekStarts) {
          await importEventsForWeek({
            weekStart: ws,
            weekDates: getWeekDates(ws),
            events: events ?? [],
            existing: current.filter((s) => s.weekStart === ws),
          });
        }
      } catch (e) {
        console.warn("[workforce] auto import", e);
        autoSyncRef.current = "";
      }
    })();
  }, [
    isAdmin,
    eventsLoading,
    pendingEventImports,
    needsSessionCleanup,
    weekStartsKey,
    weekStarts,
    events,
  ]);

  const nameByUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of members) {
      m.set(r.uid, r.displayName?.trim() || r.email.split("@")[0] || r.uid);
    }
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
        const count = countAssignmentsInWeek(displaySchedules, m.uid);
        const status = computeWorkerStatus(avail, chipWeekDates, count);
        if (statusFilter !== "all" && status !== statusFilter) return false;
        return true;
      })
      .map((m) => {
        const avail = resolveAvailability(availMap, m.uid);
        const count = countAssignmentsInWeek(displaySchedules, m.uid);
        const status = computeWorkerStatus(avail, chipWeekDates, count);
        return { member: m, avail, count, status };
      })
      .sort((a, b) => {
        const nameA = (a.member.displayName || a.member.email || "").trim();
        const nameB = (b.member.displayName || b.member.email || "").trim();
        return nameA.localeCompare(nameB, "ko", { sensitivity: "base" });
      });
  }, [
    members,
    teamFilter,
    search,
    statusFilter,
    availMap,
    displaySchedules,
    chipWeekDates,
  ]);

  const summary = useMemo(
    () => summarizeWeek(displaySchedules),
    [displaySchedules],
  );
  const duplicates = useMemo(
    () => findDuplicateSameDayPairs(displaySchedules),
    [displaySchedules],
  );
  const unavailableHits = useMemo(
    () => findUnavailableAssignments(displaySchedules, availMap),
    [displaySchedules, availMap],
  );
  const unassignedWorkers = useMemo(
    () =>
      members.filter(
        (m) =>
          (teamFilter === "all" || normalizeTeamId(m.team_id) === teamFilter) &&
          countAssignmentsInWeek(displaySchedules, m.uid) === 0,
      ).length,
    [members, displaySchedules, teamFilter],
  );

  const workerGroups = useMemo(() => {
    if (workers.length === 0) return [];
    const statusSuffix =
      statusFilter !== "all"
        ? ` · ${WORKFORCE_WORKER_STATUS_LABELS[statusFilter]}`
        : "";
    const adminItems = workers.filter((w) => w.member.role === "admin");
    const groups: Array<{ key: string; label: string; items: typeof workers }> =
      TEAM_IDS.map((teamId) => ({
        key: teamId as string,
        label: `${TEAM_LABELS[teamId]}${statusSuffix}`,
        items: workers.filter(
          (w) => w.member.role !== "admin" && normalizeTeamId(w.member.team_id) === teamId,
        ),
      })).filter((g) => g.items.length > 0);
    if (adminItems.length > 0) {
      groups.unshift({ key: "admin", label: `관리자${statusSuffix}`, items: adminItems });
    }
    return groups;
  }, [workers, statusFilter]);

  const patchScheduleFields = async (
    schedule: WorkforceSchedule,
    patch: Partial<{ venue: string; requiredCount: number; title: string }>,
  ) => {
    try {
      const id = await ensureWorkforceSchedulePersisted(schedule);
      await updateWorkforceSchedule(id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "일정 수정에 실패했습니다.");
    }
  };

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
        displaySchedules,
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
      const count = countAssignmentsInWeek(displaySchedules, uid);
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
      const scheduleId = await ensureWorkforceSchedulePersisted(schedule);
      const baseIds = schedule.id.startsWith("virtual:")
        ? []
        : schedule.assignedUserIds;
      const assignees = [...new Set([...baseIds, ...userIds])];
      await setScheduleAssignees(scheduleId, assignees, {
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
            scheduleId,
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
    if (schedule.id.startsWith("virtual:")) return;
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

  const openEdit = async (s: WorkforceSchedule) => {
    let target = s;
    if (s.id.startsWith("virtual:")) {
      setBusy(true);
      try {
        const id = await ensureWorkforceSchedulePersisted(s);
        target = { ...s, id };
      } catch (e) {
        setError(e instanceof Error ? e.message : "일정 저장에 실패했습니다.");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }
    setEditingId(target.id);
    setForm({
      title: target.title,
      date: target.date,
      startTime: target.startTime,
      venue: target.venue,
      requiredCount: target.requiredCount,
      teamIds: target.teamIds,
      note: target.note,
      color: target.color,
    });
    setFormOpen(true);
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
          weekStart: getWeekStartMonday(parseYmd(form.date)),
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
    <div className={cn("space-y-3", standalone && "pb-6")}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {standalone ? null : (
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                인력 배치 스케줄러
              </h1>
            )}
            <Badge
              variant={
                weekMeta?.status === "confirmed" ? "success" : "warning"
              }
            >
              {weekMeta?.status === "confirmed" ? "확정" : "임시"}
            </Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatRangeLabel(cursor, rangeSpan)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/30 p-0.5">
              {(
                [
                  ["1w", "1주"],
                  ["2w", "2주"],
                  ["1m", "1달"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    rangeSpan === key
                      ? "bg-accent/20 text-accent"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    setRangeSpan(key);
                    setCursor((c) => normalizeRangeCursor(c, key));
                    if (key === "1m") setBoardLayout("calendar");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-xl border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  boardLayout === "columns"
                    ? "bg-accent/20 text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setBoardLayout("columns")}
              >
                <LayoutGrid className="size-3.5" /> 보드
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  boardLayout === "calendar"
                    ? "bg-accent/20 text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setBoardLayout("calendar")}
              >
                <CalendarDays className="size-3.5" /> 달력
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background/60 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() =>
                  setCursor((c) => shiftRangeCursor(c, rangeSpan, -1))
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[7.5rem] text-center text-sm font-medium tabular-nums">
                {formatRangeLabel(cursor, rangeSpan)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() =>
                  setCursor((c) => shiftRangeCursor(c, rangeSpan, 1))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl"
              onClick={() => {
                const today = toYmd(new Date());
                setCursor(normalizeRangeCursor(today, rangeSpan));
              }}
            >
              오늘
            </Button>
            <select
              className="h-8 rounded-xl border border-border bg-background px-2 text-xs"
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
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl"
            disabled={busy || pendingEventImports === 0}
            onClick={() =>
              void (async () => {
                setBusy(true);
                setError("");
                try {
                  let imported = 0;
                  let skipped = 0;
                  let cleaned = 0;
                  for (const ws of weekStarts) {
                    const result = await importEventsForWeek({
                      weekStart: ws,
                      weekDates: getWeekDates(ws),
                      events,
                      existing: schedules.filter((s) => s.weekStart === ws),
                    });
                    imported += result.imported;
                    skipped += result.skipped;
                    cleaned += result.cleaned;
                  }
                  alert(
                    `스케줄에서 ${imported}개 일정을 가져왔습니다.` +
                      (skipped > 0
                        ? ` (이미 연결된 ${skipped}개는 건너뜀)`
                        : "") +
                      (cleaned > 0
                        ? ` · 중복 카드 ${cleaned}개 정리`
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
            className="h-8 rounded-xl"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  for (const ws of weekStarts) {
                    await saveWeekDraft(ws);
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : "임시저장 실패");
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
            className="h-8 rounded-xl"
            disabled={busy}
            onClick={() =>
              void (async () => {
                if (
                  !confirm(
                    "표시 중인 기간의 배정을 확정하면 배정된 유저에게 공개·알림됩니다. 계속할까요?",
                  )
                )
                  return;
                setBusy(true);
                try {
                  for (const s of displaySchedules) {
                    if (s.id.startsWith("virtual:")) {
                      await ensureWorkforceSchedulePersisted(s);
                    }
                  }
                  const allConfirmed: WorkforceSchedule[] = [];
                  for (const ws of weekStarts) {
                    const { schedules: confirmed } =
                      await confirmWorkforceWeek(ws);
                    allConfirmed.push(...confirmed);
                  }
                  if (user) {
                    await notifyWorkforceWeekConfirmed({
                      createdByUserId: user.uid,
                      schedules: allConfirmed,
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
            className="h-8 rounded-xl text-red-300 hover:text-red-200"
            disabled={busy}
            onClick={() =>
              void (async () => {
                const ym = yearMonthFromYmd(cursor);
                if (
                  !confirm(
                    `${ym} 월에 속한 인력 배정 일정을 모두 삭제합니다. 가능일 설정은 유지됩니다. 계속할까요?`,
                  )
                )
                  return;
                setBusy(true);
                try {
                  const n = await deleteSchedulesInMonth(ym);
                  alert(`${ym} 월 일정 ${n}건을 삭제했습니다.`);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "월 일정 삭제 실패",
                  );
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            이번 달 일정 삭제
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-red-300 hover:text-red-200"
            disabled={busy}
            onClick={() =>
              void (async () => {
                if (
                  !confirm(
                    "표시 중인 기간의 일정·배정을 모두 삭제합니다. 계속할까요?",
                  )
                )
                  return;
                setBusy(true);
                try {
                  for (const ws of weekStarts) {
                    await resetWorkforceWeek(ws);
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : "초기화 실패");
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            전체 초기화
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Worker sidebar */}
        <aside className="rounded-2xl border border-border bg-card/80 lg:max-h-[calc(100dvh-200px)] lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" />
              <p className="text-sm font-semibold">근무자 목록</p>
              {selectedWorkerIds.length > 0 ? (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent">
                  선택 {selectedWorkerIds.length}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] lg:hidden"
              onClick={() => setWorkersOpen((o) => !o)}
            >
              {workersOpen ? "접기" : "펼치기"}
            </Button>
          </div>

          <div
            className={cn(
              "space-y-3 p-3",
              !workersOpen && "hidden lg:block",
              "lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto",
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이름 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-xl pl-8 text-sm"
              />
            </div>
            <select
              className="h-8 w-full rounded-xl border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
            >
              <option value="all">전체</option>
              {(
                Object.keys(
                  WORKFORCE_WORKER_STATUS_LABELS,
                ) as WorkforceWorkerStatus[]
              ).map((k) => (
                <option key={k} value={k}>
                  {WORKFORCE_WORKER_STATUS_LABELS[k]}
                </option>
              ))}
            </select>

            {workerGroups.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                조건에 맞는 근무자가 없습니다.
              </p>
            ) : (
              <>
              <p className="px-0.5 text-[10px] text-muted-foreground">
                요일 칩: 골드=가능 · 빨강=불가 (멤버 «근무 가능일» 반영)
              </p>
              {workerGroups.map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="sticky top-0 z-[1] -mx-1 border-b border-border/60 bg-card/95 px-1.5 py-1 text-[11px] font-semibold tracking-wide text-foreground backdrop-blur-sm">
                    {group.label}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({group.items.length})
                    </span>
                  </p>
                  {group.items.map(({ member, avail, count, status }) => {
                    const selected = selectedWorkerIds.includes(member.uid);
                    return (
                      <div
                        key={member.uid}
                        draggable={isDesktop}
                        onDragStart={() => setDragUserId(member.uid)}
                        onDragEnd={() => setDragUserId(null)}
                        className={cn(
                          "rounded-xl border border-border/80 bg-background/50 p-2.5 transition-colors",
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
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {member.email}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              이번주 {count}/{avail.weeklyMaxAssignments}회
                            </p>
                          </div>
                          <span
                            className={cn(
                              "mt-1 size-2 shrink-0 rounded-full",
                              STATUS_DOT[status],
                            )}
                            title={WORKFORCE_WORKER_STATUS_LABELS[status]}
                          />
                        </div>
                        <div className="mt-2 flex gap-1">
                          {WEEKDAY_KEYS.map((k, i) => {
                            const date = chipWeekDates[i]!;
                            const on = isUserAvailableOnDate(avail, date);
                            return (
                              <span
                                key={k}
                                className={cn(
                                  "flex h-6 flex-1 items-center justify-center rounded-md text-[10px] font-semibold",
                                  on
                                    ? "bg-accent/25 text-accent"
                                    : "bg-red-500/20 text-red-300",
                                )}
                                title={`${WEEKDAY_LABELS[k]} ${date} · ${on ? "가능" : "불가"}`}
                              >
                                {WEEKDAY_LABELS[k]}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-accent hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAvailEditUser(member);
                            }}
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              </>
            )}
          </div>
        </aside>

        {/* Board / Calendar */}
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-muted/20 p-2 sm:p-3">
          {boardLayout === "calendar" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_KEYS.map((k) => (
                  <div
                    key={k}
                    className="py-1 text-center text-[11px] font-semibold text-muted-foreground"
                  >
                    {WEEKDAY_LABELS[k]}
                  </div>
                ))}
              </div>
              {calendarWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5">
                  {week.map((date, di) => {
                    if (!date) {
                      return (
                        <div
                          key={`empty-${wi}-${di}`}
                          className="min-h-[110px] rounded-xl bg-transparent"
                        />
                      );
                    }
                    const daySchedules = displaySchedules.filter(
                      (s) => s.date === date,
                    );
                    const dayRequired = daySchedules.reduce(
                      (a, s) => a + s.requiredCount,
                      0,
                    );
                    const dayAssigned = daySchedules.reduce(
                      (a, s) => a + s.assignedUserIds.length,
                      0,
                    );
                    const shortage = Math.max(0, dayRequired - dayAssigned);
                    const { label } = formatDayHeader(date);
                    const isToday = date === toYmd(new Date());
                    return (
                      <div
                        key={date}
                        className={cn(
                          "flex min-h-[120px] flex-col rounded-xl border border-border/70 bg-card/90 p-1.5 shadow-sm",
                          shortage > 0 && "border-red-300/50",
                          isToday && "ring-2 ring-accent/50",
                        )}
                        onDragOver={(e) => {
                          if (isDesktop) e.preventDefault();
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
                          <span
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              isToday ? "text-accent" : "text-foreground",
                            )}
                          >
                            {label}
                          </span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-accent"
                            onClick={() => openCreate(date)}
                            aria-label="일정 추가"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                          {daySchedules.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="rounded-md px-1.5 py-1 text-left text-[10px] font-medium text-white"
                              style={{ backgroundColor: s.color }}
                              onClick={() => void openEdit(s)}
                              onDragOver={(e) => {
                                if (isDesktop) e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (!dragUserId) return;
                                void tryAssign(s, [dragUserId]);
                                setDragUserId(null);
                              }}
                            >
                              <span className="block truncate">
                                {s.startTime} {s.title}
                              </span>
                              <span className="opacity-90">
                                {s.assignedUserIds.length}/{s.requiredCount}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-2",
                rangeSpan === "2w"
                  ? "min-w-[1180px] grid-cols-7"
                  : "min-w-[1180px] grid-cols-7",
              )}
            >
              {weekDates.map((date) => {
                const daySchedules = displaySchedules.filter(
                  (s) => s.date === date,
                );
                const dayRequired = daySchedules.reduce(
                  (a, s) => a + s.requiredCount,
                  0,
                );
                const dayAssigned = daySchedules.reduce(
                  (a, s) => a + s.assignedUserIds.length,
                  0,
                );
                const shortage = Math.max(0, dayRequired - dayAssigned);
                const hasShortage = shortage > 0 && dayRequired > 0;
                const emptyDay = daySchedules.length === 0;
                const { label } = formatDayHeader(date);
                const weekdayKey = weekdayKeyFromYmd(date);

                return (
                  <section
                    key={date}
                    className={cn(
                      "flex min-h-[160px] flex-col rounded-2xl border border-border/70 shadow-sm",
                      hasShortage || emptyDay
                        ? "bg-[repeating-linear-gradient(-45deg,rgba(22,26,34,0.92),rgba(22,26,34,0.92)_7px,rgba(167,175,191,0.08)_7px,rgba(167,175,191,0.08)_14px)]"
                        : "bg-card/90",
                    )}
                  >
                    <header className="space-y-1.5 border-b border-border/60 px-2.5 py-2.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-sm font-semibold">
                          {WEEKDAY_LABELS[weekdayKey]}요일
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {label}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                          일정 {daySchedules.length}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            dayAssigned >= dayRequired && dayRequired > 0
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-200",
                          )}
                        >
                          배치 {dayAssigned}/{dayRequired || 0}
                        </span>
                        {hasShortage ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
                            부족 {shortage}
                          </span>
                        ) : null}
                      </div>
                    </header>

                    <div className="flex flex-1 flex-col gap-2 p-2">
                      {daySchedules.map((s) => (
                        <ScheduleCard
                          key={s.id}
                          schedule={s}
                          nameByUid={nameByUid}
                          defaultExpanded={daySchedules.length <= 2}
                          onEdit={() => void openEdit(s)}
                          onDelete={() =>
                            void (async () => {
                              if (s.id.startsWith("virtual:")) {
                                setError(
                                  "스케줄 원본 일정은 배정 화면에서 삭제할 수 없습니다. 월간 취합표에서 수정하세요.",
                                );
                                return;
                              }
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
                          onPatch={(patch) =>
                            void patchScheduleFields(s, patch)
                          }
                          isDesktop={isDesktop}
                        />
                      ))}

                      <button
                        type="button"
                        onClick={() => openCreate(date)}
                        className="mt-auto flex h-10 items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background/40 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                      >
                        <Plus className="size-3.5" /> 일정 추가
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
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
                  const s = displaySchedules.find(
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
        weekDates={chipWeekDates}
        onClose={() => setAvailEditUser(null)}
        onSave={async (patch) => {
          if (!availEditUser) return;
          await upsertAvailability(availEditUser.uid, patch);
          setAvailEditUser(null);
        }}
        onUnlockWeek={async (weekStart) => {
          if (!availEditUser) return;
          const current = resolveAvailability(availMap, availEditUser.uid);
          await upsertAvailability(availEditUser.uid, {
            memberSubmittedWeeks: current.memberSubmittedWeeks.filter(
              (w) => w !== weekStart,
            ),
          });
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
  defaultExpanded = true,
  onEdit,
  onDelete,
  onDropWorker,
  onClickAssign,
  onRemoveUser,
  onPatch,
  isDesktop,
}: {
  schedule: WorkforceSchedule;
  nameByUid: Map<string, string>;
  defaultExpanded?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDropWorker: () => void;
  onClickAssign: () => void;
  onRemoveUser: (uid: string) => void;
  onPatch: (patch: Partial<{ venue: string; requiredCount: number }>) => void;
  isDesktop: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const [venueOpen, setVenueOpen] = useState(false);
  const [venueDraft, setVenueDraft] = useState(schedule.venue);
  useEffect(() => {
    setOpen(defaultExpanded);
  }, [schedule.id, defaultExpanded]);
  useEffect(() => {
    setVenueDraft(schedule.venue);
  }, [schedule.id, schedule.venue]);

  const filled = schedule.assignedUserIds.length;
  const need = schedule.requiredCount;
  const full = need > 0 && filled >= need;
  const short = Math.max(0, need - filled);

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-background/80 shadow-sm"
      style={{ borderTopColor: schedule.color, borderTopWidth: 3 }}
      onDragOver={(e) => {
        if (isDesktop) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropWorker();
      }}
    >
      <div className="flex items-start justify-between gap-1.5 px-2.5 pt-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold leading-snug hover:text-accent"
          onClick={onEdit}
          title={schedule.title || "근무"}
        >
          {schedule.title || "근무"}
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "접기" : "펼치기"}
            title={open ? "접기" : "펼치기"}
          >
            {open ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-300"
            onClick={onDelete}
            aria-label="삭제"
            title="삭제"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 px-2.5 pb-2 pt-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {schedule.startTime}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              full
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-200",
            )}
          >
            {full ? "✓ " : ""}
            {filled}/{need}명
            {full ? " · 충원 완료" : short > 0 ? ` · 부족 ${short}` : ""}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              venueOpen
                ? "border-accent/50 bg-accent/10 text-accent"
                : schedule.venue?.trim()
                  ? "border-accent/40 bg-accent/5 text-accent"
                  : "border-border bg-background/60 text-muted-foreground hover:border-accent/40 hover:text-accent",
            )}
            title={schedule.venue?.trim() || "근무 장소 입력"}
            aria-label={schedule.venue?.trim() || "근무 장소 입력"}
            onClick={(e) => {
              e.stopPropagation();
              setVenueOpen((v) => !v);
            }}
          >
            <MapPin className="size-3.5" />
          </button>
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/30 px-1 py-0.5"
            title="필요 인원"
          >
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() =>
                onPatch({
                  requiredCount: Math.max(0, schedule.requiredCount - 1),
                })
              }
            >
              <Minus className="size-3" />
            </button>
            <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums">
              {need}
            </span>
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() =>
                onPatch({ requiredCount: schedule.requiredCount + 1 })
              }
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>

        {venueOpen ? (
          <Input
            autoFocus
            value={venueDraft}
            placeholder="근무 장소 상세 입력"
            className="h-8 w-full rounded-lg text-xs"
            onChange={(e) => setVenueDraft(e.target.value)}
            onBlur={() => {
              if (venueDraft.trim() !== schedule.venue.trim()) {
                onPatch({ venue: venueDraft.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (venueDraft.trim() !== schedule.venue.trim()) {
                  onPatch({ venue: venueDraft.trim() });
                }
                setVenueOpen(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}

        {open ? (
          <div className="space-y-2 pt-0.5">
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-2">
              {schedule.assignedUserIds.length === 0 ? (
                <p className="py-1.5 text-center text-[10px] text-muted-foreground">
                  배정된 근무자 없음
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {schedule.assignedUserIds.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                    >
                      <span className="truncate">
                        {nameByUid.get(uid) || uid}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 opacity-70 hover:opacity-100"
                        onClick={() => onRemoveUser(uid)}
                        aria-label="배정 해제"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClickAssign}
              className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-accent/20 text-[11px] font-medium text-accent hover:bg-accent/30"
            >
              <Users className="size-3" /> 근무자 배정
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function AvailabilityDialog({
  member,
  avail,
  weekDates,
  onClose,
  onSave,
  onUnlockWeek,
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
  onUnlockWeek: (weekStart: string) => Promise<void>;
}) {
  const [max, setMax] = useState(5);
  const [weekdays, setWeekdays] = useState<Record<WeekdayKey, boolean>>({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: true,
  });
  const [exceptions, setExceptions] = useState<
    Record<string, "available" | "unavailable">
  >({});
  const [busy, setBusy] = useState(false);

  const dialogWeekStart =
    weekDates[0] != null ? getWeekStartMonday(parseYmd(weekDates[0])) : "";
  const memberLocked =
    !!avail &&
    !!dialogWeekStart &&
    avail.memberSubmittedWeeks.includes(dialogWeekStart);

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
              ? `${member.displayName || member.email} · 기본 요일 + 날짜 예외`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {memberLocked ? (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <p>
              멤버가 이 주 가능일을 신청해 잠긴 상태입니다. 관리자는 아래에서
              바로 수정할 수 있고, 잠금을 해제하면 멤버가 다시 신청할 수
              있습니다.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await onUnlockWeek(dialogWeekStart);
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              멤버 신청 잠금 해제
            </Button>
          </div>
        ) : null}
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
          <p className="text-xs text-muted-foreground">표시 주 날짜 예외</p>
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
