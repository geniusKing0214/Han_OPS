"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!live) return;
    setMetaTitle(live.title);
    setMetaVenue(live.venue);
    setMetaNotice(live.notice ?? "");
    setMetaColor(live.color ?? "#C8A96B");
    setSaveError("");
  }, [resetKey, live?.id]);

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
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">장소</label>
            <Input
              value={metaVenue}
              onChange={(e) => setMetaVenue(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground">특이사항</label>
            <Textarea
              value={metaNotice}
              onChange={(e) => setMetaNotice(e.target.value)}
              className="min-h-[72px]"
              disabled={saving}
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
                disabled={saving}
              />
              <Input
                value={metaColor}
                onChange={(e) => setMetaColor(e.target.value)}
                className="flex-1 font-mono text-xs"
                disabled={saving}
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
              disabled={saving}
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
            슬롯별 시작 시간·정원·신청 인원. 변경 시 곧바로 저장됩니다.
          </p>
          <div className="space-y-3">
            {session.slots.map((slot) => (
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
                      value={slot.start_time}
                      onClick={(e) => openTimePickerIfSupported(e.currentTarget)}
                      onTouchStart={(e) =>
                        openTimePickerIfSupported(e.currentTarget)
                      }
                      onChange={(e) =>
                        void onPersist(
                          updateSlot(live, sessionId, slot.id, {
                            start_time: e.target.value,
                          }),
                        )
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      모집 인원 (정원)
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={slot.capacity}
                      onChange={(e) =>
                        void onPersist(
                          updateSlot(live, sessionId, slot.id, {
                            capacity: parsePositiveInt(
                              e.target.value,
                              slot.capacity,
                            ),
                          }),
                        )
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">신청 인원</span>
                    <Input
                      type="number"
                      min={0}
                      value={slot.applied_count}
                      onChange={(e) =>
                        void onPersist(
                          updateSlot(live, sessionId, slot.id, {
                            applied_count: parsePositiveInt(
                              e.target.value,
                              slot.applied_count,
                            ),
                          }),
                        )
                      }
                      disabled={saving}
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
            ))}
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
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">모집 인원</span>
                <Input
                  type="number"
                  min={1}
                  value={newSlotDraft.cap}
                  onChange={(e) =>
                    setNewSlotDraft((p) => ({ ...p, cap: e.target.value }))
                  }
                  disabled={saving}
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
              disabled={saving}
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
