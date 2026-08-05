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
  const [startTime, setStartTime] = useState("09:00");
  const [position, setPosition] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [color, setColor] = useState("#C8A96B");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setDate(defaultDate ?? "");
    setStartTime("09:00");
    setPosition("");
    setCapacity("1");
    setColor("#C8A96B");
    setError("");
  }, [open, defaultDate]);

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
    if (!startTime) {
      setError("시작 시간을 입력하세요.");
      return;
    }
    const cap = Math.max(1, Number.parseInt(capacity, 10) || 0);
    const positionLabel = position.trim();

    const payload: Omit<EventItem, "id"> = positionLabel
      ? {
          title: title.trim(),
          venue: venue.trim(),
          team_ids: teamExposureToTeamIds("team_1"),
          sessions: [{ id: crypto.randomUUID(), date, slots: [] }],
          attendance: { ...DEFAULT_ATTENDANCE_SETTINGS },
          usePositions: true,
          positions: [
            {
              id: crypto.randomUUID(),
              label: positionLabel,
              capacity: cap,
              slots: [
                {
                  id: crypto.randomUUID(),
                  time: startTime,
                  capacity: cap,
                  applied_count: 0,
                },
              ],
            } satisfies PositionDef,
          ],
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
                  start_time: startTime,
                  capacity: cap,
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

          <div className="grid grid-cols-2 gap-3">
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
                시작 시간 *
              </label>
              <Input
                type="time"
                step={60}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                포지션
              </label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="예: 딜러"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                필요 인원 *
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={capacity}
                onChange={(e) =>
                  setCapacity(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="예: 5"
              />
            </div>
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
