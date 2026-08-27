"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import type { EventItem, PositionDef } from "@/types/schedule";
import { DEFAULT_POSITIONS } from "@/types/schedule";
import { updateEventDetails } from "@/lib/schedule-mutations";
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

        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">이벤트 정보</p>
            <div className="grid w-fit grid-cols-2 gap-x-5 gap-y-1.5">
              <span
                className="text-[11px] text-muted-foreground"
                title="켜면 신청기간이 아니어도 이 일정은 항상 신청을 받습니다. 신청전 기간에 만든 급한 일정도 바로 신청중으로 바꿀 수 있습니다. 언제든 다시 꺼서 원래 신청기간 기준으로 되돌릴 수 있습니다."
              >
                상시 허용
              </span>
              <span className="text-[11px] text-muted-foreground">색상</span>
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
              <Input
                type="color"
                className="h-8 w-12 shrink-0 cursor-pointer p-1"
                value={metaColor}
                onChange={(e) => setMetaColor(e.target.value)}
              />
            </div>
          </div>
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
                    <div className="space-y-1.5 pl-8 sm:pl-12">
                      {(pos.slots ?? []).map((slot, si) => (
                        <div key={slot.id} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            step={60}
                            className="h-8 w-24 min-w-0 text-sm tabular-nums sm:w-28"
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
                            className="h-8 w-14 min-w-0 text-sm"
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

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={saving || !metaTitle.trim() || !metaVenue.trim()}
              onClick={() => void handleSaveMeta()}
            >
              저장
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 text-red-600 hover:bg-red-500/10 hover:text-red-700"
              disabled={saving}
              onClick={() => void onDeleteEvent()}
            >
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
