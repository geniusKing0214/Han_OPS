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

export type CreateScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  /** 저장 시 완성된 이벤트(id 없음 — 부모에서 부여) */
  onSave: (payload: Omit<EventItem, "id">) => Promise<void>;
  /** 특정 날짜에서 "일정 추가"로 열었을 때 — 날짜를 자동으로 채우고
   * 날짜 입력 UI 대신 읽기 전용으로 표시한다. */
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
  return `${parts[0]}.${parts[1]}.${parts[2]}. (${dow})`;
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
  const [date, setDate] = useState("");
  const [positionRows, setPositionRows] = useState<PositionRow[]>([
    emptyPositionRow(),
  ]);
  const [color, setColor] = useState("#C8A96B");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setDate(defaultDate ?? "");
    setPositionRows([emptyPositionRow()]);
    setColor("#C8A96B");
    setError("");
  }, [open, defaultDate]);

  const addPositionRow = () =>
    setPositionRows((prev) => [
      ...prev,
      emptyPositionRow(prev[prev.length - 1]?.time ?? "09:00"),
    ]);

  const removePositionRow = (id: string) =>
    setPositionRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );

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
    if (!date) {
      setError("날짜를 입력하세요.");
      return;
    }
    const useMultiplePositions =
      positionRows.length > 1 || positionRows[0]!.label.trim() !== "";

    const payload: Omit<EventItem, "id"> = useMultiplePositions
      ? {
          title: title.trim(),
          venue: venue.trim(),
          team_ids: teamExposureToTeamIds("team_1"),
          sessions: [{ id: crypto.randomUUID(), date, slots: [] }],
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
          sessions: [
            {
              id: crypto.randomUUID(),
              date,
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
            },
          ],
          attendance: { ...DEFAULT_ATTENDANCE_SETTINGS },
          usePositions: false,
          positions: [],
          forceApplyOpen: false,
        };
    if (color.trim()) payload.color = color.trim();

    try {
      await onSave(payload);
      onOpenChange(false);
    } catch {
      setError("저장에 실패했습니다. Firestore 규칙과 네트워크를 확인하세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>스케줄 생성</DialogTitle>
          <DialogDescription>
            이벤트명, 장소, 날짜, 시간, 정원을 입력합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              날짜 *
            </label>
            {defaultDate ? (
              <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm">
                {formatDateLabel(defaultDate)}
              </div>
            ) : (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              포지션 · 시간 · 인원
            </label>
            <div className="space-y-2">
              {positionRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Input
                    className="flex-1 min-w-0"
                    value={row.label}
                    onChange={(e) =>
                      updatePositionLabel(row.id, e.target.value)
                    }
                    placeholder="예: 딜러 (선택)"
                  />
                  <Input
                    type="time"
                    step={60}
                    className="w-[7.5rem] shrink-0 tabular-nums"
                    value={row.time}
                    onChange={(e) =>
                      updatePositionTime(row.id, e.target.value)
                    }
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="w-14 shrink-0"
                    value={row.capacity}
                    onChange={(e) =>
                      updatePositionCapacity(
                        row.id,
                        e.target.value.replace(/[^0-9]/g, ""),
                      )
                    }
                    placeholder="인원"
                  />
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={addPositionRow}
            >
              + 포지션 추가
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              표시 색상
            </label>
            <div className="flex gap-2">
              <Input
                type="color"
                className="h-9 w-12 cursor-pointer p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#C8A96B"
                className="flex-1 font-mono text-xs"
              />
            </div>
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
