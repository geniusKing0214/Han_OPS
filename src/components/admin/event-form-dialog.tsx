"use client";

import { useEffect, useState } from "react";

import type { EventItem, PositionDef, Slot } from "@/types/schedule";
import { DEFAULT_ATTENDANCE_SETTINGS } from "@/types/attendance";
import { teamExposureToTeamIds } from "@/types/team";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type CreateScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  /** 저장 시 완성된 이벤트(id 없음 — 부모에서 부여) */
  onSave: (payload: Omit<EventItem, "id">) => Promise<void>;
  /** 특정 날짜에서 "일정 추가"로 열었을 때 — 해당 날짜를 선택된 날짜
   * 목록에 미리 담아둔다. 그 상태로도 다른 날짜를 추가/삭제할 수 있다. */
  defaultDate?: string;
};

type PositionRow = { id: string; label: string; time: string; capacity: string };

function emptyPositionRow(time = "09:00"): PositionRow {
  return { id: crypto.randomUUID(), label: "", time, capacity: "1" };
}

function formatDateLabel(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${parts[1]}.${parts[2]} (${dow})`;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  saving,
  onSave,
  defaultDate,
}: CreateScheduleDialogProps) {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [positionRows, setPositionRows] = useState<PositionRow[]>([
    emptyPositionRow(),
  ]);
  const [color, setColor] = useState("#C8A96B");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setDates(defaultDate ? [defaultDate] : []);
    setRangeStart("");
    setRangeEnd("");
    setPositionRows([emptyPositionRow()]);
    setColor("#C8A96B");
    setNotice("");
    setError("");
  }, [open, defaultDate]);

  /** 시작일~종료일 범위의 모든 날짜를 추가 (연속 날짜) — 종료일이 비어있으면
   * 시작일 하루만 추가한다 (다른 날에 같은 일정을 하나씩 추가하는 용도). */
  const addDateRange = () => {
    if (!rangeStart) return;
    const end = rangeEnd || rangeStart;
    if (rangeStart > end) return;
    const added: string[] = [];
    const cur = new Date(rangeStart + "T00:00:00");
    const endD = new Date(end + "T00:00:00");
    while (cur <= endD && added.length < 60) {
      const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      added.push(ymd);
      cur.setDate(cur.getDate() + 1);
    }
    setDates((prev) => Array.from(new Set([...prev, ...added])).sort());
    setRangeStart("");
    setRangeEnd("");
  };

  const removeDate = (ymd: string) =>
    setDates((prev) => prev.filter((d) => d !== ymd));

  const removePositionRow = (id: string) =>
    setPositionRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );

  /** 같은 포지션(이름·시간·인원)을 바로 아래에 복사해 추가 — 각 행의
   * "추가" 버튼이 곧 포지션 추가 수단이라 별도의 전체 추가 버튼은 없다. */
  const duplicatePositionRow = (id: string) =>
    setPositionRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const copy: PositionRow = { ...prev[idx]!, id: crypto.randomUUID() };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });

  const updatePositionLabel = (id: string, label: string) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label } : r)),
    );

  const updatePositionTime = (id: string, time: string) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, time } : r)),
    );

  const updatePositionCapacity = (id: string, capacity: string) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, capacity } : r)),
    );

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !venue.trim()) {
      setError("이벤트명과 장소는 필수입니다.");
      return;
    }
    if (dates.length === 0) {
      setError("날짜를 최소 1개 추가하세요.");
      return;
    }
    const useMultiplePositions =
      positionRows.length > 1 || positionRows[0]!.label.trim() !== "";

    const payload: Omit<EventItem, "id"> = useMultiplePositions
      ? {
          title: title.trim(),
          venue: venue.trim(),
          team_ids: teamExposureToTeamIds("team_1"),
          sessions: dates.map((d) => ({
            id: crypto.randomUUID(),
            date: d,
            slots: [],
          })),
          attendance: { ...DEFAULT_ATTENDANCE_SETTINGS },
          usePositions: true,
          positions: positionRows.map((row, idx) => {
            const rowCap = Math.max(1, Number.parseInt(row.capacity, 10) || 0);
            return {
              id: crypto.randomUUID(),
              label: row.label.trim() || `포지션 ${idx + 1}`,
              capacity: rowCap,
              slots: [
                {
                  id: crypto.randomUUID(),
                  time: row.time || "09:00",
                  capacity: rowCap,
                  applied_count: 0,
                },
              ],
            } satisfies PositionDef;
          }),
          forceApplyOpen: false,
        }
      : {
          title: title.trim(),
          venue: venue.trim(),
          team_ids: teamExposureToTeamIds("team_1"),
          sessions: dates.map((d) => ({
            id: crypto.randomUUID(),
            date: d,
            slots: [
              {
                id: crypto.randomUUID(),
                start_time: positionRows[0]!.time || "09:00",
                capacity: Math.max(
                  1,
                  Number.parseInt(positionRows[0]!.capacity, 10) || 0,
                ),
                applied_count: 0,
              } satisfies Slot,
            ],
          })),
          attendance: { ...DEFAULT_ATTENDANCE_SETTINGS },
          usePositions: false,
          positions: [],
          forceApplyOpen: false,
        };
    if (color.trim()) payload.color = color.trim();
    if (notice.trim()) payload.notice = notice.trim();

    try {
      await onSave(payload);
      onOpenChange(false);
    } catch {
      setError("저장에 실패했습니다. Firestore 규칙과 네트워크를 확인하세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>스케줄 생성</DialogTitle>
          <DialogDescription>
            이벤트명, 장소, 날짜, 시간, 정원을 입력합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[1fr_1fr_3.5rem] gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                이벤트명 *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: WDHL 인천지사"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                장소 *
              </label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="예: 인천"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                표시 색상
              </label>
              <Input
                type="color"
                className="h-9 cursor-pointer p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              날짜 * <span className="font-normal">(연속·다른 날 추가 가능)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="flex-1"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <span className="shrink-0 text-xs text-muted-foreground">~</span>
              <Input
                type="date"
                className="flex-1"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                placeholder="비우면 하루만"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={!rangeStart}
                onClick={addDateRange}
              >
                + 추가
              </Button>
            </div>
            {dates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {dates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs tabular-nums"
                  >
                    {formatDateLabel(d)}
                    <button
                      type="button"
                      onClick={() => removeDate(d)}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="날짜 삭제"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                시작일만 입력하고 추가하면 하루만, 종료일까지 채우면 연속으로
                한 번에 추가됩니다.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              포지션 · 시간 · 인원
            </label>
            <div className="space-y-2">
              {positionRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-[1fr_1fr_3.5rem] gap-3">
                    <Input
                      className="min-w-0"
                      value={row.label}
                      onChange={(e) =>
                        updatePositionLabel(row.id, e.target.value)
                      }
                      placeholder="예: 딜러 (선택)"
                    />
                    <Input
                      type="time"
                      step={60}
                      className="tabular-nums"
                      value={row.time}
                      onChange={(e) =>
                        updatePositionTime(row.id, e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={row.capacity}
                      onChange={(e) =>
                        updatePositionCapacity(
                          row.id,
                          e.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="인원"
                    />
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-accent px-1 text-xs"
                    onClick={() => duplicatePositionRow(row.id)}
                    aria-label="포지션 추가"
                    title="이 포지션 복사해서 추가"
                  >
                    추가
                  </button>
                  {positionRows.length > 1 ? (
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-red-600 px-1"
                      onClick={() => removePositionRow(row.id)}
                      aria-label="포지션 삭제"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              메모
            </label>
            <Textarea
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="예: 검정 셔츠 착용"
              className="min-h-[72px]"
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
