"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import type { EventItem } from "@/types/schedule";
import {
  addSession,
  addSlot,
  removeSession,
  removeSlot,
  setSessionDate,
  updateEventDetails,
  updateSlot,
} from "@/lib/schedule-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function parsePositiveInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 빈 입력·잘못된 입력은 0으로 저장(blur 시) */
function parseNonNegInt(value: string): number {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type SlotFieldDraft = { start: string; cap: string; applied: string };

function openTimePickerIfSupported(target: EventTarget | null) {
  const el = target as HTMLInputElement | null;
  if (!el || el.type !== "time") return;
  if (typeof el.showPicker === "function") {
    try {
      el.showPicker();
    } catch {
      // gesture restrictions in some browsers
    }
  }
}

export type SessionScheduleSheetBodyProps = {
  /** 증가 시 메타 입력란을 현재 Firestore 값으로 초기화 */
  resetKey: number;
  eventId: string;
  sessionId: string;
  events: EventItem[];
  saving: boolean;
  onPersist: (next: EventItem) => Promise<void>;
  onDeleteEvent: () => Promise<void>;
  onClose: () => void;
};

export function SessionScheduleSheetBody({
  resetKey,
  eventId,
  sessionId,
  events,
  saving,
  onPersist,
  onDeleteEvent,
  onClose,
}: SessionScheduleSheetBodyProps) {
  const live = events.find((e) => e.id === eventId);
  const session = live?.sessions.find((s) => s.id === sessionId);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaVenue, setMetaVenue] = useState("");
  const [metaNotice, setMetaNotice] = useState("");
  const [metaColor, setMetaColor] = useState("#C8A96B");
  const [saveError, setSaveError] = useState("");
  const [addSessionDatePick, setAddSessionDatePick] = useState("");
  const [newSlotDraft, setNewSlotDraft] = useState({ time: "09:00", cap: "4" });
  const [slotDrafts, setSlotDrafts] = useState<Record<string, SlotFieldDraft>>(
    {},
  );
  const slotDraftsRef = useRef(slotDrafts);
  slotDraftsRef.current = slotDrafts;

  const sessionReady = Boolean(live && session);
  const slotIdsKey =
    session?.slots
      .map((s) => s.id)
      .sort()
      .join(",") ?? "";

  useEffect(() => {
    if (!live) return;
    setMetaTitle(live.title);
    setMetaVenue(live.venue);
    setMetaNotice(live.notice ?? "");
    setMetaColor(live.color ?? "#C8A96B");
    setSaveError("");
  }, [resetKey, live?.id]);

  /** 시트를 열거나 세션을 바꿀 때 슬롯 입력값 초기화(Firestore 스냅샷마다는 초기화하지 않음) */
  useEffect(() => {
    if (!sessionReady) return;
    const ln = events.find((e) => e.id === eventId);
    const sn = ln?.sessions.find((s) => s.id === sessionId);
    if (!ln || !sn) return;
    const init: Record<string, SlotFieldDraft> = {};
    for (const sl of sn.slots) {
      init[sl.id] = {
        start: sl.start_time,
        cap: String(sl.capacity),
        applied: String(sl.applied_count),
      };
    }
    setSlotDrafts(init);
  }, [resetKey, eventId, sessionId, sessionReady]);

  /** 슬롯 행이 추가·삭제될 때만 드래프트 병합 */
  useEffect(() => {
    if (!slotIdsKey) return;
    const ln = events.find((e) => e.id === eventId);
    const sn = ln?.sessions.find((s) => s.id === sessionId);
    if (!ln || !sn) return;
    setSlotDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const sl of sn.slots) {
        if (next[sl.id] === undefined) {
          next[sl.id] = {
            start: sl.start_time,
            cap: String(sl.capacity),
            applied: String(sl.applied_count),
          };
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!sn.slots.some((s) => s.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [slotIdsKey, eventId, sessionId]);

  const flushSlotDraft = useCallback(
    (slotId: string) => {
      const draft = slotDraftsRef.current[slotId];
      const ln = events.find((e) => e.id === eventId);
      const sn = ln?.sessions.find((s) => s.id === sessionId);
      if (!draft || !ln || !sn) return;
      const slot = sn.slots.find((s) => s.id === slotId);
      if (!slot) return;

      const cap = parseNonNegInt(draft.cap);
      const applied = parseNonNegInt(draft.applied);
      const start = draft.start.trim() || slot.start_time;

      if (
        cap === slot.capacity &&
        applied === slot.applied_count &&
        start === slot.start_time
      ) {
        return;
      }

      void onPersist(
        updateSlot(ln, sessionId, slotId, {
          start_time: start,
          capacity: cap,
          applied_count: applied,
        }),
      );
    },
    [eventId, sessionId, events, onPersist],
  );

  const handleSaveMeta = async () => {
    if (!live) return false;
    if (!metaTitle.trim() || !metaVenue.trim()) return false;
    setSaveError("");
    try {
      await onPersist(
        updateEventDetails(live, {
          title: metaTitle.trim(),
          venue: metaVenue.trim(),
          notice: metaNotice.trim() || undefined,
          color: metaColor.trim() || undefined,
        }),
      );
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "저장에 실패했습니다. 권한·Firestore 규칙을 확인하세요.",
      );
      return false;
    }
    return true;
  };

  if (!live || !session) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>일정을 찾을 수 없음</SheetTitle>
          <SheetDescription>
            삭제되었거나 동기화 중입니다. 시트를 닫았다가 다시 시도하세요.
          </SheetDescription>
        </SheetHeader>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8">{live.title}</SheetTitle>
        <SheetDescription>{live.venue}</SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-6 text-sm">
        {saveError ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {saveError}
          </p>
        ) : null}

        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">이벤트 기본 정보</p>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">이벤트명</label>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">장소</label>
            <Input
              value={metaVenue}
              onChange={(e) => setMetaVenue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">특이사항</label>
            <Textarea
              value={metaNotice}
              onChange={(e) => setMetaNotice(e.target.value)}
              className="min-h-[72px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">표시 색상</label>
            <div className="flex gap-2">
              <Input
                type="color"
                className="h-9 w-14 cursor-pointer p-1"
                value={metaColor}
                onChange={(e) => setMetaColor(e.target.value)}
              />
              <Input
                value={metaColor}
                onChange={(e) => setMetaColor(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={saving || !metaTitle.trim() || !metaVenue.trim()}
              onClick={() => void handleSaveMeta()}
            >
              기본 정보 저장
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">이 날짜 세션</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              disabled={saving}
              onClick={() => {
                if (!confirm(`${session.date} 세션과 포함된 슬롯을 삭제할까요?`))
                  return;
                void (async () => {
                  await onPersist(removeSession(live, sessionId));
                  onClose();
                })();
              }}
            >
              이 세션만 삭제
            </Button>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">세션 날짜</label>
            <Input
              type="date"
              className="w-full max-w-[200px]"
              value={session.date}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                void onPersist(setSessionDate(live, sessionId, v));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              날짜를 바꾸면「날짜별 그룹」에서 다른 날로 이동합니다.
            </p>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            슬롯별 시작 시간·정원·신청 인원은 입력 후 다른 칸으로 이동하거나
            키보드의「완료」를 누르면 저장됩니다.
          </p>
          <div className="space-y-3">
            {session.slots.map((slot) => {
              const d = slotDrafts[slot.id] ?? {
                start: slot.start_time,
                cap: String(slot.capacity),
                applied: String(slot.applied_count),
              };
              return (
              <div
                key={slot.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="grid gap-2 sm:grid-cols-3 sm:gap-3 flex-1">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">시작</span>
                    <Input
                      type="time"
                      step={60}
                      value={d.start}
                      onClick={(e) => openTimePickerIfSupported(e.currentTarget)}
                      onTouchStart={(e) =>
                        openTimePickerIfSupported(e.currentTarget)
                      }
                      onChange={(e) =>
                        setSlotDrafts((p) => {
                          const cur = p[slot.id] ?? {
                            start: slot.start_time,
                            cap: String(slot.capacity),
                            applied: String(slot.applied_count),
                          };
                          return {
                            ...p,
                            [slot.id]: { ...cur, start: e.target.value },
                          };
                        })
                      }
                      onBlur={() => flushSlotDraft(slot.id)}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      모집 인원 (정원)
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={d.cap}
                      onChange={(e) =>
                        setSlotDrafts((p) => {
                          const cur = p[slot.id] ?? {
                            start: slot.start_time,
                            cap: String(slot.capacity),
                            applied: String(slot.applied_count),
                          };
                          return {
                            ...p,
                            [slot.id]: { ...cur, cap: e.target.value },
                          };
                        })
                      }
                      onBlur={() => flushSlotDraft(slot.id)}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">신청 인원</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={d.applied}
                      onChange={(e) =>
                        setSlotDrafts((p) => {
                          const cur = p[slot.id] ?? {
                            start: slot.start_time,
                            cap: String(slot.capacity),
                            applied: String(slot.applied_count),
                          };
                          return {
                            ...p,
                            [slot.id]: { ...cur, applied: e.target.value },
                          };
                        })
                      }
                      onBlur={() => flushSlotDraft(slot.id)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="sm:ml-auto"
                  disabled={saving}
                  onClick={() => {
                    if (!confirm("이 슬롯을 삭제할까요?")) return;
                    void onPersist(removeSlot(live, sessionId, slot.id));
                  }}
                >
                  슬롯 삭제
                </Button>
              </div>
            );
            })}
          </div>

          <Separator />

          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-2 sm:grid-cols-2 flex-1">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">새 슬롯 · 시작</span>
                <Input
                  type="time"
                  step={60}
                  value={newSlotDraft.time}
                  onClick={(e) => openTimePickerIfSupported(e.currentTarget)}
                  onTouchStart={(e) => openTimePickerIfSupported(e.currentTarget)}
                  onChange={(e) =>
                    setNewSlotDraft((p) => ({ ...p, time: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">모집 인원</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={newSlotDraft.cap}
                  onChange={(e) =>
                    setNewSlotDraft((p) => ({ ...p, cap: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={saving}
              onClick={() =>
                void onPersist(
                  addSlot(live, sessionId, {
                    start_time: newSlotDraft.time,
                    capacity: Math.max(
                      1,
                      parsePositiveInt(newSlotDraft.cap, 4),
                    ),
                    applied_count: 0,
                  }),
                )
              }
            >
              슬롯 추가
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            이 이벤트에 다른 날짜 세션 추가
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="date"
              className="w-[180px]"
              value={addSessionDatePick}
              onChange={(e) => setAddSessionDatePick(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={saving || !addSessionDatePick}
              onClick={() => {
                const d = addSessionDatePick;
                if (!d) return;
                void (async () => {
                  await onPersist(addSession(live, d));
                  setAddSessionDatePick("");
                })();
              }}
            >
              날짜(세션) 추가
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            disabled={saving}
            onClick={() => void onDeleteEvent()}
          >
            <Trash2 className="size-3.5" />
            일정 전체 삭제
          </Button>
        </div>
      </div>
    </>
  );
}
