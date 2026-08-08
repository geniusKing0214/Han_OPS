"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  applyToTraining,
  cancelTrainingApplication,
  closeTraining,
  createTraining,
  deleteTraining,
  reopenTraining,
  subscribeTrainings,
} from "@/lib/firestore-training";
import type { TrainingItem } from "@/types/training";
import {
  CreateTrainingDialog,
  type CreateTrainingInput,
} from "@/components/training/create-training-dialog";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CHIP_COLORS = [
  "bg-accent/15 text-accent",
  "bg-blue-500/15 text-blue-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-purple-500/15 text-purple-700",
  "bg-pink-500/15 text-pink-700",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildCalendarWeeks(month: Date): (string | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toYmd(new Date(year, m, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function chipColorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length]!;
}

function formatTime(startAt: string): string {
  const time = startAt.split("T")[1];
  return time ? time.slice(0, 5) : "";
}

export function TrainingBoard() {
  const { user, profile, isAdmin } = useAuth();
  const [trainings, setTrainings] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeTrainings(
        (rows) => {
          setTrainings(rows);
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    [],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, TrainingItem[]>();
    for (const t of trainings) {
      const date = t.startAt.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(t);
      map.set(date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
    return map;
  }, [trainings]);

  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const today = toYmd(new Date());
  const selectedTrainings = byDate.get(selectedDate) ?? [];

  const handleCreate = async (input: CreateTrainingInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    await createTraining({
      title: input.title,
      location: input.location,
      startAt: `${input.date}T${input.time}`,
      content: input.content,
      capacity: input.capacity,
      createdBy: user.uid,
      createdByName: profile?.displayName || user.email || "멤버",
    });
    setSelectedDate(input.date);
  };

  const handleApply = async (training: TrainingItem) => {
    if (!user) return;
    setActionError("");
    setBusyId(training.id);
    try {
      await applyToTraining(training.id, user.uid, profile?.displayName || user.email || "멤버");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "신청에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (training: TrainingItem) => {
    if (!user) return;
    setActionError("");
    setBusyId(training.id);
    try {
      await cancelTrainingApplication(training.id, user.uid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "취소에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (training: TrainingItem) => {
    if (!user) return;
    setActionError("");
    setBusyId(training.id);
    try {
      await closeTraining(training.id, user.uid, isAdmin);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "마감에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReopen = async (training: TrainingItem) => {
    if (!user) return;
    setActionError("");
    setBusyId(training.id);
    try {
      await reopenTraining(training.id, user.uid, isAdmin);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (training: TrainingItem) => {
    if (!user) return;
    if (!confirm(`"${training.title}" 교육을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setActionError("");
    setBusyId(training.id);
    try {
      await deleteTraining(training.id, user.uid, isAdmin);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="교육 신청"
        description="교육 일정을 달력에서 한눈에 확인하고 신청하세요."
      />

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="w-28 text-center text-sm font-medium tabular-nums">
                {monthLabel}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button type="button" variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
              교육 생성
            </Button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[560px] grid-cols-7 gap-1">
                {weeks.flat().map((ymd, idx) => {
                  if (!ymd) return <div key={idx} className="min-h-20 rounded-md" />;
                  const dayTrainings = byDate.get(ymd) ?? [];
                  const isToday = ymd === today;
                  const isSelected = ymd === selectedDate;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => setSelectedDate(ymd)}
                      className={cn(
                        "min-h-20 rounded-md border border-border p-1 text-left align-top transition-colors hover:border-accent/50",
                        isSelected ? "border-accent bg-accent/10" : "bg-muted/10",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          isToday ? "font-bold text-accent" : "text-muted-foreground",
                        )}
                      >
                        {Number(ymd.slice(-2))}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayTrainings.slice(0, 2).map((t) => (
                          <p
                            key={t.id}
                            className={cn(
                              "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                              chipColorFor(t.id),
                            )}
                          >
                            {t.title}
                          </p>
                        ))}
                        {dayTrainings.length > 2 ? (
                          <p className="text-[10px] text-muted-foreground">
                            +{dayTrainings.length - 2}건
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {selectedDate.slice(5).replace("-", "/")} 교육 ({selectedTrainings.length}건)
          </p>

          {actionError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {actionError}
            </p>
          ) : null}

          {selectedTrainings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              이 날짜에 등록된 교육이 없습니다.
            </p>
          ) : (
            selectedTrainings.map((t) => {
              const applied = !!user && t.applicants.some((a) => a.uid === user.uid);
              const isOwner = !!user && (t.createdBy === user.uid || isAdmin);
              const isFull = t.applicants.length >= t.capacity;
              const busy = busyId === t.id;
              return (
                <div
                  key={t.id}
                  className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium">{t.title}</p>
                        <Badge variant={t.status === "open" ? "success" : "destructive"}>
                          {t.status === "open" ? "모집중" : "마감"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">{formatTime(t.startAt)}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {t.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {t.applicants.length}/{t.capacity}명
                        </span>
                      </p>
                    </div>
                  </div>
                  {t.content ? (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {t.content}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    개설자 {t.createdByName || "—"}
                    {t.applicants.length > 0
                      ? ` · 신청자 ${t.applicants.map((a) => a.name).join(", ")}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {applied ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-500/10"
                        disabled={busy}
                        onClick={() => void handleCancel(t)}
                      >
                        신청 취소
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        disabled={busy || t.status !== "open" || isFull}
                        onClick={() => void handleApply(t)}
                      >
                        {t.status === "open" && !isFull ? "신청하기" : "마감됨"}
                      </Button>
                    )}
                    {isOwner ? (
                      <>
                        {t.status === "open" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleClose(t)}
                          >
                            마감하기
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleReopen(t)}
                          >
                            다시 열기
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-500/10"
                          disabled={busy}
                          onClick={() => void handleDelete(t)}
                        >
                          삭제하기
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <CreateTrainingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        defaultDate={selectedDate}
      />
    </div>
  );
}
