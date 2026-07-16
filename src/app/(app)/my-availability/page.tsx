"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, X } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  subscribeMyAvailability,
  upsertMyAvailability,
} from "@/lib/firestore-workforce";
import {
  formatDayHeader,
  formatWeekRangeLabel,
  getNextWeekStart,
  getWeekDates,
  toYmd,
} from "@/lib/workforce-dates";
import { isUserAvailableOnDate } from "@/lib/workforce-logic";
import { cn } from "@/lib/utils";
import type { WorkforceAvailability } from "@/types/workforce";

export default function MyAvailabilityPage() {
  const { user } = useAuth();
  const nextWeekStart = useMemo(() => getNextWeekStart(), []);
  const weekDates = useMemo(
    () => getWeekDates(nextWeekStart),
    [nextWeekStart],
  );
  const [avail, setAvail] = useState<WorkforceAvailability | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const locked = !!avail?.memberSubmittedWeeks.includes(nextWeekStart);

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
    const next: Record<string, boolean> = {};
    for (const d of weekDates) {
      next[d] = isUserAvailableOnDate(avail, d);
    }
    setDraft(next);
    setDirty(false);
    setSaved(false);
  }, [avail, weekDates]);

  const availableCount = useMemo(
    () => weekDates.filter((d) => draft[d]).length,
    [weekDates, draft],
  );

  const toggleDay = (date: string) => {
    if (locked) return;
    setDraft((prev) => ({ ...prev, [date]: !prev[date] }));
    setDirty(true);
    setSaved(false);
  };

  const setAll = (on: boolean) => {
    if (locked) return;
    const next: Record<string, boolean> = {};
    for (const d of weekDates) next[d] = on;
    setDraft(next);
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    if (!user || locked) return;
    setBusy(true);
    setError("");
    try {
      const dateExceptions: Record<string, "available" | "unavailable"> = {};
      for (const d of weekDates) {
        dateExceptions[d] = draft[d] ? "available" : "unavailable";
      }
      await upsertMyAvailability({
        weekStart: nextWeekStart,
        dateExceptions,
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

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-28">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">근무 가능일</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-sky-300">익주</span>만 신청할 수
          있습니다. 신청 후에는 관리자만 변경할 수 있습니다.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-300">
          신청 대상 · 익주
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {formatWeekRangeLabel(nextWeekStart)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          가능 {availableCount}/7일
          {locked ? " · 신청 완료(잠금)" : ""}
        </p>
      </div>

      {locked ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            익주 가능일 신청이 완료되었습니다. 내용을 바꾸려면 관리자에게
            요청해 주세요.
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-xl"
            onClick={() => setAll(true)}
          >
            익주 전부 가능
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-xl"
            onClick={() => setAll(false)}
          >
            익주 전부 불가
          </Button>
        </div>
      )}

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

      <div className="space-y-2.5">
        {weekDates.map((date) => {
          const on = !!draft[date];
          const { label, dow } = formatDayHeader(date);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              disabled={locked}
              onClick={() => toggleDay(date)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                on
                  ? "border-sky-400/40 bg-sky-500/15 shadow-sm"
                  : "border-red-400/30 bg-red-500/10",
                locked && "cursor-default opacity-90",
                isToday && "ring-2 ring-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold",
                  on ? "bg-sky-500 text-white" : "bg-red-500/90 text-white",
                )}
              >
                <span className="text-[10px] opacity-90">{dow}</span>
                <span className="tabular-nums leading-none">{label}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {dow}요일 · {date}
                </p>
                <p
                  className={cn(
                    "text-xs font-medium",
                    on ? "text-sky-300" : "text-red-300",
                  )}
                >
                  {on ? "근무 가능" : "근무 불가"}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  on
                    ? "bg-sky-500/30 text-sky-200"
                    : "bg-red-500/30 text-red-200",
                )}
              >
                {locked ? (
                  <Lock className="size-3.5 opacity-80" />
                ) : on ? (
                  <Check className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {!locked ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto max-w-lg md:pt-2">
            <Button
              type="button"
              variant="accent"
              className="h-12 w-full rounded-xl text-base"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              {busy
                ? "신청 중…"
                : dirty
                  ? "익주 가능일 신청하기"
                  : "변경 후 신청해 주세요"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
