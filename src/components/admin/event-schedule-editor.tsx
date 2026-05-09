"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { EventItem } from "@/types/schedule";
import {
  addSession,
  addSlot,
  removeSession,
  removeSlot,
  updateEventDetails,
  updateSlot,
} from "@/lib/schedule-mutations";
import { deleteEvent, saveEvent } from "@/lib/firestore-events";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

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
      // Some browsers block showPicker() without a direct gesture.
    }
  }
}

export type EventScheduleEditorProps = {
  event: EventItem;
  /** Called after successful delete (navigate away in parent) */
  onDeleted?: () => void;
};

export function EventScheduleEditor({ event, onDeleted }: EventScheduleEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [sessionDatePick, setSessionDatePick] = useState("");
  const [newSlotDraft, setNewSlotDraft] = useState<
    Record<string, { time: string; cap: string }>
  >({});

  const [metaTitle, setMetaTitle] = useState(event.title);
  const [metaVenue, setMetaVenue] = useState(event.venue);
  const [metaNotice, setMetaNotice] = useState(event.notice ?? "");
  const [metaColor, setMetaColor] = useState(event.color ?? "#C8A96B");

  const persist = async (next: EventItem) => {
    setSaving(true);
    setSaveError("");
    try {
      await saveEvent(next);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "저장에 실패했습니다. 관리자 권한(admin) 및 Firestore rules 게시 상태를 확인하세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!metaTitle.trim() || !metaVenue.trim()) return false;
    setSaving(true);
    setSaveError("");
    try {
      await saveEvent(
        updateEventDetails(event, {
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
          : "저장에 실패했습니다. 관리자 권한(admin) 및 Firestore rules 게시 상태를 확인하세요.",
      );
      return false;
    } finally {
      setSaving(false);
    }
    return true;
  };

  const handleDeleteEvent = async () => {
    if (
      !confirm(
        `"${event.title}" 일정을 삭제할까요? 세션·슬롯 데이터도 함께 삭제됩니다.`,
      )
    )
      return;
    setSaving(true);
    try {
      await deleteEvent(event.id);
      onDeleted?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          수정은 즉시 저장됩니다. 작업이 끝나면 창을 닫으세요.
        </p>
        <Button
          type="button"
          size="sm"
          variant="accent"
          onClick={() => {
            window.close();
          }}
        >
          수정 완료 · 창 닫기
        </Button>
      </div>

      {saveError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {saveError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
          <CardDescription>
            이벤트명, 장소, 특이사항, 표시 색상입니다. 변경 후「기본 정보 저장」을
            누르세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              이벤트명
            </label>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">장소</label>
            <Input
              value={metaVenue}
              onChange={(e) => setMetaVenue(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              특이사항
            </label>
            <Textarea
              value={metaNotice}
              onChange={(e) => setMetaNotice(e.target.value)}
              className="min-h-[80px]"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              표시 색상
            </label>
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
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="accent"
              disabled={saving || !metaTitle.trim() || !metaVenue.trim()}
              onClick={() => {
                void (async () => {
                  const ok = await handleSaveMeta();
                  if (ok) window.close();
                })();
              }}
            >
              수정 완료
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={saving}
              onClick={() => void handleDeleteEvent()}
            >
              <Trash2 className="size-3.5" />
              일정 전체 삭제
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          날짜 · 슬롯
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          슬롯별로 시작 시간, 모집 인원(정원), 신청 인원을 수정합니다. 변경 시 곧바로
          저장됩니다.
        </p>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">날짜 추가</label>
              <Input
                type="date"
                className="w-[180px]"
                value={sessionDatePick}
                onChange={(e) => setSessionDatePick(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={saving || !sessionDatePick}
              onClick={() => {
                const d = sessionDatePick;
                if (!d) return;
                void persist(addSession(event, d));
                setSessionDatePick("");
              }}
            >
              날짜(세션) 추가
            </Button>
          </div>

          {event.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              세션이 없습니다. 위에서 날짜를 추가하거나 스케줄 생성 시 세션을
              넣어 주세요.
            </p>
          ) : (
            event.sessions.map((sess) => (
              <div
                key={sess.id}
                className="rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium tabular-nums">{sess.date}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    disabled={saving}
                    onClick={() => {
                      if (
                        !confirm(`${sess.date} 세션과 포함된 슬롯을 삭제할까요?`)
                      )
                        return;
                      void persist(removeSession(event, sess.id));
                    }}
                  >
                    세션 삭제
                  </Button>
                </div>

                <div className="space-y-3">
                  {sess.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">
                            시작
                          </span>
                          <Input
                            type="time"
                            step={60}
                            value={slot.start_time}
                            onClick={(e) => openTimePickerIfSupported(e.currentTarget)}
                            onTouchStart={(e) =>
                              openTimePickerIfSupported(e.currentTarget)
                            }
                            onChange={(e) =>
                              void persist(
                                updateSlot(event, sess.id, slot.id, {
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
                              void persist(
                                updateSlot(event, sess.id, slot.id, {
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
                          <span className="text-[11px] text-muted-foreground">
                            신청 인원
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={slot.applied_count}
                            onChange={(e) =>
                              void persist(
                                updateSlot(event, sess.id, slot.id, {
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
                          void persist(removeSlot(event, sess.id, slot.id));
                        }}
                      >
                        슬롯 삭제
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">
                        새 슬롯 · 시작
                      </span>
                      <Input
                        type="time"
                        step={60}
                        value={
                          newSlotDraft[`${event.id}-${sess.id}`]?.time ?? "09:00"
                        }
                        onClick={(e) => openTimePickerIfSupported(e.currentTarget)}
                        onTouchStart={(e) =>
                          openTimePickerIfSupported(e.currentTarget)
                        }
                        onChange={(e) =>
                          setNewSlotDraft((p) => ({
                            ...p,
                            [`${event.id}-${sess.id}`]: {
                              time: e.target.value,
                              cap: p[`${event.id}-${sess.id}`]?.cap ?? "4",
                            },
                          }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">
                        모집 인원
                      </span>
                      <Input
                        type="number"
                        min={1}
                        value={
                          newSlotDraft[`${event.id}-${sess.id}`]?.cap ?? "4"
                        }
                        onChange={(e) =>
                          setNewSlotDraft((p) => ({
                            ...p,
                            [`${event.id}-${sess.id}`]: {
                              time:
                                p[`${event.id}-${sess.id}`]?.time ?? "09:00",
                              cap: e.target.value,
                            },
                          }))
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
                    onClick={() => {
                      const key = `${event.id}-${sess.id}`;
                      const draft = newSlotDraft[key] ?? {
                        time: "09:00",
                        cap: "4",
                      };
                      void persist(
                        addSlot(event, sess.id, {
                          start_time: draft.time,
                          capacity: Math.max(1, parsePositiveInt(draft.cap, 4)),
                          applied_count: 0,
                        }),
                      );
                    }}
                  >
                    슬롯 추가
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
