"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Lock, Pencil, X } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMyApplications } from "@/hooks/use-my-applications";
import {
  subscribeMyAvailability,
  upsertMyAvailability,
} from "@/lib/firestore-workforce";
import {
  formatDayHeader,
  formatWeekRangeLabel,
  getAvailabilityWindowStatus,
  getNextWeekStart,
  getWeekDates,
  toYmd,
} from "@/lib/workforce-dates";
import { isUserAvailableOnDate } from "@/lib/workforce-logic";
import { cn } from "@/lib/utils";
import type { WorkforceAvailability } from "@/types/workforce";

type DayState = "available" | "pending" | "done" | "unavailable";

const DAY_STATE_LABEL: Record<DayState, string> = {
  available: "가능",
  pending: "대기중",
  done: "완료",
  unavailable: "불가",
};

const DAY_STATE_STYLE: Record<
  DayState,
  { card: string; badge: string; text: string }
> = {
  available: {
    card: "border-emerald-400/40 bg-emerald-500/15 shadow-sm",
    badge: "bg-emerald-500 text-white",
    text: "text-emerald-300",
  },
  pending: {
    card: "border-blue-400/40 bg-blue-500/15 shadow-sm",
    badge: "bg-blue-500 text-white",
    text: "text-blue-300",
  },
  done: {
    card: "border-zinc-400/40 bg-zinc-500/15 shadow-sm",
    badge: "bg-zinc-500 text-white",
    text: "text-zinc-300",
  },
  unavailable: {
    card: "border-red-400/30 bg-red-500/10",
    badge: "bg-red-500/90 text-white",
    text: "text-red-300",
  },
};

type MyAvailabilityFormProps = {
  /** 다이얼로그 등 좁은 레이아웃에서 sticky 하단 버튼 비활성 */
  compact?: boolean;
  /** 가능 일수 변경 시 부모에 전달 (대시보드 카드 숫자용) */
  onAvailableCountChange?: (count: number) => void;
};

export function MyAvailabilityForm({
  compact = false,
  onAvailableCountChange,
}: MyAvailabilityFormProps) {
  const { user } = useAuth();
  const { items: myApplications } = useMyApplications();
  const nextWeekStart = useMemo(() => getNextWeekStart(), []);
  const weekDates = useMemo(
    () => getWeekDates(nextWeekStart),
    [nextWeekStart],
  );
  const windowStatus = useMemo(() => getAvailabilityWindowStatus(), []);
  const appStatusByDate = useMemo(() => {
    const map = new Map<string, "pending" | "done">();
    for (const a of myApplications) {
      if (!weekDates.includes(a.date)) continue;
      if (a.status === "approved" || a.status === "completed") {
        map.set(a.date, "done");
      } else if (a.status === "pending" && map.get(a.date) !== "done") {
        map.set(a.date, "pending");
      }
    }
    return map;
  }, [myApplications, weekDates]);
  const [avail, setAvail] = useState<WorkforceAvailability | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [memoDialogDate, setMemoDialogDate] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  const submitted = !!avail?.memberSubmittedWeeks.includes(nextWeekStart);
  const windowOpen = windowStatus === "open";
  const locked = submitted || !windowOpen;

  useEffect(() => {
    if (!user) return;
    return subscribeMyAvailability(
      user.uid,
      (row) => setAvail(row),
      (e) => setError(e.message),
    );
  }, [user]);

  useEffect(() => {
    if (!avail) return;
    const nextDraft: Record<string, boolean> = {};
    const nextNotes: Record<string, string> = {};
    for (const d of weekDates) {
      nextDraft[d] = isUserAvailableOnDate(avail, d);
      if (avail.dateExceptionNotes[d]) nextNotes[d] = avail.dateExceptionNotes[d];
    }
    setDraft(nextDraft);
    setNotes(nextNotes);
    setDirty(false);
    setSaved(false);
  }, [avail, weekDates]);

  const availableCount = useMemo(
    () => weekDates.filter((d) => draft[d]).length,
    [weekDates, draft],
  );

  useEffect(() => {
    onAvailableCountChange?.(availableCount);
  }, [availableCount, onAvailableCountChange]);

  const openMemoDialog = (date: string) => {
    if (locked) return;
    setMemoDialogDate(date);
    setMemoDraft(notes[date] ?? "");
  };

  const closeMemoDialog = () => {
    setMemoDialogDate(null);
    setMemoDraft("");
  };

  const confirmMemo = () => {
    if (!memoDialogDate) return;
    const date = memoDialogDate;
    setDraft((prev) => ({ ...prev, [date]: false }));
    setNotes((prev) => ({ ...prev, [date]: memoDraft.trim() }));
    setDirty(true);
    setSaved(false);
    closeMemoDialog();
  };

  const toggleDay = (date: string) => {
    if (locked) return;
    const isCurrentlyOn = !!draft[date];
    if (isCurrentlyOn) {
      // 가능 → 불가로 전환: 사유 메모 입력 모달을 먼저 띄운다.
      openMemoDialog(date);
      return;
    }
    // 불가 → 가능으로 전환: 바로 반영하고 메모는 제거.
    setDraft((prev) => ({ ...prev, [date]: true }));
    setNotes((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    if (!user || locked) return;
    setBusy(true);
    setError("");
    try {
      const dateExceptions: Record<string, "available" | "unavailable"> = {};
      const dateExceptionNotes: Record<string, string> = {};
      for (const d of weekDates) {
        dateExceptions[d] = draft[d] ? "available" : "unavailable";
        if (!draft[d] && notes[d]) dateExceptionNotes[d] = notes[d];
      }
      await upsertMyAvailability({
        weekStart: nextWeekStart,
        dateExceptions,
        dateExceptionNotes,
      });
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const today = toYmd(new Date());
  const memoDialogDayInfo = memoDialogDate
    ? formatDayHeader(memoDialogDate)
    : null;

  return (
    <div className={cn("space-y-4", !compact && "pb-28")}>
      <div className="rounded-2xl border border-border bg-card p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
          신청 대상 · 익주
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {formatWeekRangeLabel(nextWeekStart)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          가능 {availableCount}/7일
          {submitted ? " · 신청 완료(잠금)" : ""}
        </p>
      </div>

      {submitted ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            익주 가능일 신청이 완료되었습니다. 내용을 바꾸려면 관리자에게
            요청해 주세요.
          </p>
        </div>
      ) : windowStatus === "before" ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            신청 기간이 아직 시작되지 않았습니다. 근무 가능일은{" "}
            <span className="font-medium text-foreground">
              이번 주 화·수·목요일
            </span>
            에 신청할 수 있습니다.
          </p>
        </div>
      ) : windowStatus === "closed" ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            신청 기간이 종료되었습니다. 근무 가능일은{" "}
            <span className="font-medium">이번 주 화·수·목요일</span>에만
            수정할 수 있습니다.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          신청이 완료되었습니다. 이후 변경은 관리자만 가능합니다.
        </p>
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {weekDates.map((date) => {
          const on = !!draft[date];
          const appStatus = on ? appStatusByDate.get(date) : undefined;
          const dayState: DayState = !on
            ? "unavailable"
            : appStatus === "done"
              ? "done"
              : appStatus === "pending"
                ? "pending"
                : "available";
          const style = DAY_STATE_STYLE[dayState];
          const { label, dow } = formatDayHeader(date);
          const isToday = date === today;
          const note = notes[date];
          return (
            <div
              key={date}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center transition-all",
                style.card,
                locked && "opacity-90",
                isToday && "ring-2 ring-accent/40",
              )}
            >
              <button
                type="button"
                disabled={locked}
                onClick={() => toggleDay(date)}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5",
                  locked && "cursor-default",
                )}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {dow}요일
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {label}
                </span>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    style.badge,
                  )}
                >
                  {locked ? (
                    <Lock className="size-3.5 opacity-90" />
                  ) : dayState === "unavailable" ? (
                    <X className="size-4" />
                  ) : dayState === "pending" ? (
                    <Clock className="size-4" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </span>
                <span className={cn("text-[11px] font-medium", style.text)}>
                  {DAY_STATE_LABEL[dayState]}
                </span>
              </button>

              {!on ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => openMemoDialog(date)}
                  title={note || "사유 메모 없음"}
                  className={cn(
                    "flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    note
                      ? "bg-red-500/20 text-red-200"
                      : "text-red-200/60",
                    locked && "pointer-events-none opacity-70",
                  )}
                >
                  <Pencil className="size-2.5 shrink-0" />
                  <span className="truncate">{note ? "메모" : "메모 없음"}</span>
                </button>
              ) : (
                <span className="h-[18px]" />
              )}
            </div>
          );
        })}
      </div>

      {!locked ? (
        <div
          className={cn(
            compact
              ? "pt-1"
              : "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
          )}
        >
          <div className={cn(!compact && "mx-auto max-w-lg md:pt-2")}>
            <Button
              type="button"
              variant="accent"
              className="h-12 w-full rounded-xl text-base"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "신청 중…" : "익주 가능일 신청하기"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={memoDialogDate !== null}
        onOpenChange={(open) => {
          if (!open) closeMemoDialog();
        }}
      >
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>근무 불가 사유</DialogTitle>
            <DialogDescription>
              {memoDialogDayInfo
                ? `${memoDialogDayInfo.dow}요일 · ${memoDialogDate} 근무가 불가능한 이유를 간단히 남겨주세요.`
                : "근무가 불가능한 이유를 간단히 남겨주세요."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            placeholder="예: 개인 일정, 시험, 병원 진료 등"
            rows={3}
            maxLength={200}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMemoDialog}>
              취소
            </Button>
            <Button type="button" variant="accent" onClick={confirmMemo}>
              근무 불가로 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
