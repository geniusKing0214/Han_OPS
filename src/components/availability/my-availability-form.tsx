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

/** 사유로 인정하지 않는 두루뭉술한 표현 (공백 제거 후 부분 일치로 판정) */
const BANNED_MEMO_PHRASES = ["개인사정", "개인일정"];

function containsBannedMemoPhrase(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  return BANNED_MEMO_PHRASES.some((phrase) => normalized.includes(phrase));
}

type DayState = "available" | "pending" | "done" | "unavailable";

const DAY_STATE_LABEL: Record<DayState, string> = {
  available: "가능",
  pending: "대기중",
  done: "승인됨",
  unavailable: "불가",
};

const DAY_STATE_STYLE: Record<
  DayState,
  { card: string; badge: string; text: string }
> = {
  available: {
    card: "border-emerald-400/40 bg-emerald-500/15 shadow-sm",
    badge: "bg-emerald-500 text-white",
    text: "text-emerald-700",
  },
  pending: {
    card: "border-blue-400/40 bg-blue-500/15 shadow-sm",
    badge: "bg-blue-500 text-white",
    text: "text-blue-700",
  },
  done: {
    card: "border-zinc-400/40 bg-zinc-300/40 grayscale-[0.3]",
    badge: "bg-zinc-500 text-white",
    text: "text-zinc-600",
  },
  unavailable: {
    card: "border-red-400/30 bg-red-500/10",
    badge: "bg-red-500/90 text-white",
    text: "text-red-700",
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
  const [memoError, setMemoError] = useState("");

  const submitted = !!avail?.memberSubmittedWeeks.includes(nextWeekStart);
  const windowOpen = windowStatus === "open";
  // 화~금(신청 기간 중)에는 제출 여부 관계없이 수정 가능
  // 토요일 00:00 이후(closed) 또는 신청 기간 전(before)에는 잠금
  const locked = !windowOpen;

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

  /** 불가로 표시됐지만 사유 메모가 비어 있는 날 — 신청 전 반드시 채워야 한다 */
  const missingMemoDates = useMemo(
    () =>
      weekDates.filter(
        (d) =>
          !draft[d] &&
          appStatusByDate.get(d) !== "done" &&
          (notes[d] ?? "").trim().length < 2,
      ),
    [weekDates, draft, notes, appStatusByDate],
  );

  useEffect(() => {
    onAvailableCountChange?.(availableCount);
  }, [availableCount, onAvailableCountChange]);

  const openMemoDialog = (date: string) => {
    if (locked) return;
    setMemoDialogDate(date);
    setMemoDraft(notes[date] ?? "");
    setMemoError("");
  };

  const closeMemoDialog = () => {
    setMemoDialogDate(null);
    setMemoDraft("");
    setMemoError("");
  };

  const confirmMemo = () => {
    if (!memoDialogDate) return;
    const trimmed = memoDraft.trim();
    if (trimmed.length < 2) {
      setMemoError(
        "근무 불가 사유는 반드시 입력해야 합니다. 구체적인 사유를 적어주세요.",
      );
      return;
    }
    if (containsBannedMemoPhrase(memoDraft)) {
      setMemoError(
        "'개인 사정', '개인일정' 같은 표현은 사유로 쓸 수 없습니다. 구체적인 사유를 적어주세요.",
      );
      return;
    }
    const date = memoDialogDate;
    setDraft((prev) => ({ ...prev, [date]: false }));
    setNotes((prev) => ({ ...prev, [date]: trimmed }));
    setDirty(true);
    setSaved(false);
    closeMemoDialog();
  };

  const toggleDay = (date: string) => {
    if (locked || appStatusByDate.get(date) === "done") return;
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
    if (missingMemoDates.length > 0) {
      const labels = missingMemoDates
        .map((d) => `${formatDayHeader(d).dow}요일`)
        .join(", ");
      setError(`${labels} 근무 불가 사유를 입력해야 신청할 수 있습니다.`);
      return;
    }
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
          {submitted && !windowOpen ? " · 신청 완료(잠금)" : submitted ? " · 신청 완료(수정 가능)" : ""}
        </p>
      </div>

      {/* 화~금 신청 기간 중 이미 제출한 경우: 수정 가능 안내 */}
      {windowOpen && submitted ? (
        <div className="flex items-start gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-sm text-blue-800">
          <Pencil className="mt-0.5 size-4 shrink-0" />
          <p>
            신청 완료 상태입니다.{" "}
            <span className="font-medium">화·수·목·금요일</span>에는 직접 수정할 수 있습니다.
            토요일 00:00 이후에는 관리자에게 수정 요청해 주세요.
          </p>
        </div>
      ) : !windowOpen && submitted ? (
        /* 신청 기간 외 + 제출 완료: 잠금 */
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800">
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
              이번 주 화·수·목·금요일
            </span>
            에 신청할 수 있습니다.
          </p>
        </div>
      ) : windowStatus === "closed" ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-800">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            신청 기간이 종료되었습니다. 근무 가능일은{" "}
            <span className="font-medium">이번 주 화·수·목·금요일</span>에만
            수정할 수 있습니다.
          </p>
        </div>
      ) : null}

      {error && locked ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {weekDates.map((date) => {
          const on = !!draft[date];
          // 이미 승인된(또는 완료된) 신청이 있는 날은 draft 토글 상태와
          // 무관하게 항상 "승인됨"으로 표시하고 잠근다 — 확정된 근무일의
          // 가능 여부를 실수로 바꾸지 못하게 하기 위함.
          const appStatus = appStatusByDate.get(date);
          const approvedLocked = appStatus === "done";
          const dayState: DayState = approvedLocked
            ? "done"
            : !on
              ? "unavailable"
              : appStatus === "pending"
                ? "pending"
                : "available";
          const style = DAY_STATE_STYLE[dayState];
          const { label, dow } = formatDayHeader(date);
          const isToday = date === today;
          const note = notes[date];
          const dayLocked = locked || approvedLocked;
          return (
            <div
              key={date}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center transition-all",
                style.card,
                locked && "opacity-90",
                approvedLocked && "opacity-80",
                isToday && "ring-2 ring-accent/40",
              )}
            >
              <button
                type="button"
                disabled={dayLocked}
                onClick={() => toggleDay(date)}
                title={approvedLocked ? "이미 승인된 근무일이라 변경할 수 없습니다" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5",
                  dayLocked && "cursor-not-allowed",
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
                  {locked || approvedLocked ? (
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

              {!on && !approvedLocked ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => openMemoDialog(date)}
                  title={note || "근무 불가 사유를 반드시 입력해 주세요"}
                  className={cn(
                    "flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    note
                      ? "bg-red-500/20 text-red-800"
                      : "bg-amber-500/25 text-amber-900 ring-1 ring-amber-500/50",
                    locked && "pointer-events-none opacity-70",
                  )}
                >
                  <Pencil className="size-2.5 shrink-0" />
                  <span className="truncate">{note ? "메모" : "사유 필요"}</span>
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
            {error ? (
              <p className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700">
                저장 실패: {error}
              </p>
            ) : null}
            {saved && !dirty ? (
              <p className="mb-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                저장되었습니다. 토요일 이후에는 관리자에게 수정 요청해 주세요.
              </p>
            ) : null}
            {missingMemoDates.length > 0 ? (
              <p className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800">
                {missingMemoDates
                  .map((d) => `${formatDayHeader(d).dow}요일`)
                  .join(", ")}{" "}
                근무 불가 사유를 입력해야 신청할 수 있습니다.
              </p>
            ) : null}
            <Button
              type="button"
              variant="accent"
              className="h-12 w-full rounded-xl text-base"
              disabled={busy || missingMemoDates.length > 0}
              onClick={() => void save()}
            >
              {busy ? "저장 중…" : submitted ? "수정사항 저장하기" : "익주 가능일 신청하기"}
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
            onChange={(e) => {
              setMemoDraft(e.target.value);
              if (memoError) setMemoError("");
            }}
            placeholder="예: 시험 일정, 병원 진료, 가족 행사 등 구체적으로 적어주세요"
            rows={3}
            maxLength={200}
            autoFocus
          />
          <p
            className={cn(
              "text-xs",
              memoError ? "text-red-700" : "text-muted-foreground",
            )}
          >
            {memoError || "근무 불가로 표시하려면 사유 입력이 필수입니다."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMemoDialog}>
              취소
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={memoDraft.trim().length < 2}
              onClick={confirmMemo}
            >
              근무 불가로 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
