"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import type { EventItem, PositionDef } from "@/types/schedule";
import { DEFAULT_POSITIONS } from "@/types/schedule";
import {
  addSession,
  removeSession,
  setSessionDate,
  updateEventDetails,
} from "@/lib/schedule-mutations";
import { toggleEventForceApplyOpen } from "@/lib/firestore-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


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
  const [metaUsePositions, setMetaUsePositions] = useState(false);
  const [metaPositions, setMetaPositions] = useState<PositionDef[]>(DEFAULT_POSITIONS);
  const [saveError, setSaveError] = useState("");
  const [addSessionDatePick, setAddSessionDatePick] = useState("");
  const [sessionDateDraft, setSessionDateDraft] = useState("");
  const sessionDateDraftRef = useRef(sessionDateDraft);
  sessionDateDraftRef.current = sessionDateDraft;

  useEffect(() => {
    if (!live) return;
    setMetaTitle(live.title);
    setMetaVenue(live.venue);
    setMetaNotice(live.notice ?? "");
    setMetaColor(live.color ?? "#C8A96B");
    setMetaUsePositions(live.usePositions ?? false);
    setMetaPositions(live.positions?.length ? live.positions : DEFAULT_POSITIONS);
    setSaveError("");
  }, [resetKey, live?.id]);

  const sessionDateSyncKey = live && session ? `${sessionId}:${session.date}` : "";

  useEffect(() => {
    if (!sessionDateSyncKey) return;
    const sn = events
      .find((e) => e.id === eventId)
      ?.sessions.find((s) => s.id === sessionId);
    if (!sn?.date) return;
    setSessionDateDraft(sn.date);
  }, [resetKey, sessionDateSyncKey, eventId, sessionId]);

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
          usePositions: metaUsePositions,
          positions: metaUsePositions
            ? metaPositions.filter((p) => p.label.trim())
            : [],
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
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            {saveError}
          </p>
        ) : null}

        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">상시 신청 허용</p>
              <p className="text-xs text-muted-foreground">
                켜면 신청기간이 아니어도 이 일정은 항상 신청을 받습니다. 신청전
                기간에 만든 급한 일정도 바로 신청중으로 바꿀 수 있습니다. 언제든
                다시 꺼서 원래 신청기간 기준으로 되돌릴 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!live.forceApplyOpen}
              onClick={() =>
                void toggleEventForceApplyOpen(live.id, !live.forceApplyOpen)
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                live.forceApplyOpen ? "bg-violet-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  live.forceApplyOpen ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

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

          {/* 포지션 설정 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">포지션 사용</p>
                <p className="text-[11px] text-muted-foreground">딜러·플로어·레지 등 포지션별 신청</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={metaUsePositions}
                onClick={() => setMetaUsePositions((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  metaUsePositions ? "bg-accent" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    metaUsePositions ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {metaUsePositions && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2">
                {metaPositions.map((pos, idx) => (
                  <div key={pos.id} className="rounded-md border border-border bg-muted/30 p-2.5 space-y-2">
                    {/* 포지션 이름 행 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-10 shrink-0">포지션</span>
                      <Input
                        className="flex-1 text-sm h-8"
                        placeholder="예: 딜러"
                        value={pos.label}
                        onChange={(e) =>
                          setMetaPositions((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, label: e.target.value } : p,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-red-600 px-1"
                        onClick={() =>
                          setMetaPositions((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ×
                      </button>
                    </div>
                    {/* 시간슬롯 */}
                    <div className="space-y-1.5 pl-12">
                      {(pos.slots ?? []).map((slot, si) => (
                        <div key={slot.id} className="flex items-center gap-2">
                          <Input
                            type="time"
                            step={60}
                            className="w-28 h-8 text-sm tabular-nums"
                            value={slot.time}
                            onChange={(e) =>
                              setMetaPositions((prev) =>
                                prev.map((p, i) =>
                                  i !== idx ? p : {
                                    ...p,
                                    slots: p.slots.map((s, j) =>
                                      j === si ? { ...s, time: e.target.value } : s,
                                    ),
                                  },
                                ),
                              )
                            }
                          />
                          <Input
                            type="number"
                            min={1}
                            className="w-16 h-8 text-sm"
                            placeholder="정원"
                            value={slot.capacity}
                            onChange={(e) =>
                              setMetaPositions((prev) =>
                                prev.map((p, i) =>
                                  i !== idx ? p : {
                                    ...p,
                                    slots: p.slots.map((s, j) =>
                                      j === si ? { ...s, capacity: Math.max(1, Number.parseInt(e.target.value, 10) || 1) } : s,
                                    ),
                                  },
                                ),
                              )
                            }
                          />
                          <span className="text-xs text-muted-foreground">명</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-red-600"
                            onClick={() =>
                              setMetaPositions((prev) =>
                                prev.map((p, i) =>
                                  i !== idx ? p : { ...p, slots: p.slots.filter((_, j) => j !== si) },
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() =>
                          setMetaPositions((prev) =>
                            prev.map((p, i) =>
                              i !== idx ? p : {
                                ...p,
                                slots: [
                                  ...p.slots,
                                  { id: crypto.randomUUID(), time: "09:00", capacity: 1, applied_count: 0 },
                                ],
                              },
                            ),
                          )
                        }
                      >
                        + 시간 추가
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() =>
                    setMetaPositions((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), label: "", capacity: 0, slots: [] },
                    ])
                  }
                >
                  + 포지션 추가
                </Button>
              </div>
            )}
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
              className="text-red-600 hover:text-red-700"
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
              className="min-h-11 w-full max-w-full sm:max-w-[220px]"
              value={sessionDateDraft || session.date}
              onChange={(e) => setSessionDateDraft(e.target.value)}
              onInput={(e) =>
                setSessionDateDraft((e.target as HTMLInputElement).value)
              }
              onBlur={() => {
                const next = sessionDateDraftRef.current;
                const ln = events.find((e) => e.id === eventId);
                const sn = ln?.sessions.find((s) => s.id === sessionId);
                if (!ln || !sn || !next) return;
                if (next === sn.date) return;
                void onPersist(setSessionDate(ln, sessionId, next));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              날짜를 바꾼 뒤 다른 칸을 탭하거나 바깥을 누르면 저장됩니다. 같은 화면에서
              아래「다른 날짜 세션 추가」도 사용할 수 있습니다.
            </p>
          </div>

        </div>

        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            이 이벤트에 다른 날짜 세션 추가
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <Input
              type="date"
              className="min-h-11 w-full min-w-0 sm:max-w-[220px]"
              value={addSessionDatePick}
              onChange={(e) => setAddSessionDatePick(e.target.value)}
              onInput={(e) =>
                setAddSessionDatePick((e.target as HTMLInputElement).value)
              }
            />
            <Button
              type="button"
              size="sm"
              variant="default"
              className="w-full shrink-0 sm:w-auto"
              disabled={!addSessionDatePick.trim()}
              onClick={() => {
                const d = addSessionDatePick.trim();
                if (!d) return;
                const ln = events.find((e) => e.id === eventId);
                if (!ln) return;
                void (async () => {
                  await onPersist(addSession(ln, d));
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
            className="gap-1 text-red-600 hover:bg-red-500/10 hover:text-red-700"
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
