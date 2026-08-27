"use client";

import { useEffect, useState } from "react";

import type { EventItem, PositionDef, Slot } from "@/types/schedule";
import { positionSlotKey } from "@/types/schedule";
import {
  TEAM_EXPOSURE_OPTIONS,
  teamExposureToTeamIds,
  type TeamExposure,
} from "@/types/team";
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
import { cn } from "@/lib/utils";

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

type PositionRow = {
  id: string;
  label: string;
  capacity: string;
  /** 기본 시간 — 날짜별로 따로 설정하지 않은 모든 날짜에 적용 */
  time: string;
  /** 날짜별 시간 오버라이드. key: YYYY-MM-DD */
  timeByDate: Record<string, string>;
  /** true면 시간을 정하지 않고 "시간 미정"으로 두고 인원만 확정 */
  timeUndetermined: boolean;
};

function emptyPositionRow(time = "09:00"): PositionRow {
  return {
    id: crypto.randomUUID(),
    label: "",
    capacity: "1",
    time,
    timeByDate: {},
    timeUndetermined: false,
  };
}

function formatDateLabel(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${parts[1]}.${parts[2]} (${dow})`;
}

function nextYmd(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 연속된 날짜끼리 묶어서 칩 하나로 표시하기 위한 그룹핑 */
function groupConsecutiveDates(dates: string[]): string[][] {
  const sorted = [...dates].sort();
  const groups: string[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && nextYmd(last[last.length - 1]!) === d) {
      last.push(d);
    } else {
      groups.push([d]);
    }
  }
  return groups;
}

/** 연속 구간은 "08.18~22"(같은 달) 또는 "08.18~09.02"(달이 바뀌는 경우)로 표시 */
function formatDateGroupLabel(group: string[]): string {
  if (group.length === 1) return formatDateLabel(group[0]!);
  const first = group[0]!.split("-");
  const last = group[group.length - 1]!.split("-");
  if (first[1] === last[1]) {
    return `${first[1]}.${first[2]}~${last[2]}`;
  }
  return `${first[1]}.${first[2]}~${last[1]}.${last[2]}`;
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
  /** 비어있으면 "기본 시간" 편집 중. 칩을 탭하면 그 날짜(또는 연속 구간
   * 전체)만 다른 시간으로 편집 — 구간을 탭하면 구간 안의 모든 날짜에
   * 같은 시간이 한 번에 적용된다. */
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [positionRows, setPositionRows] = useState<PositionRow[]>([
    emptyPositionRow(),
  ]);
  const [color, setColor] = useState("#C8A96B");
  const [notice, setNotice] = useState("");
  const [teamExposure, setTeamExposure] = useState<TeamExposure>("team_1");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setDates(defaultDate ? [defaultDate] : []);
    // defaultDate가 있으면 날짜 선택칸의 시작값도 그 달로 맞춰서, 달력을
    // 열었을 때 오늘 날짜가 속한 달이 아니라 작업 중인 달이 바로 보이게 한다.
    setRangeStart(defaultDate ?? "");
    setRangeEnd("");
    setActiveDates([]);
    setPositionRows([emptyPositionRow()]);
    setColor("#C8A96B");
    setNotice("");
    setTeamExposure("team_1");
    setError("");
  }, [open, defaultDate]);

  /** 날짜를 추가/삭제해서 칩 구간이 바뀌면(예: 활성화한 구간에 날짜가
   * 더 붙거나 일부가 삭제됨) 더 이상 정확히 일치하는 칩이 없을 수 있으므로
   * 기본 시간 편집으로 되돌린다. */
  useEffect(() => {
    if (activeDates.length === 0) return;
    const stillValid = groupConsecutiveDates(dates).some(
      (g) =>
        g.length === activeDates.length &&
        g.every((d, i) => d === activeDates[i]),
    );
    if (!stillValid) setActiveDates([]);
  }, [dates, activeDates]);

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

  /** 날짜 하나 또는 연속 구간(그룹) 전체를 한 번에 제거 */
  const removeDates = (ymds: string[]) => {
    const toRemove = new Set(ymds);
    setDates((prev) => prev.filter((d) => !toRemove.has(d)));
    setPositionRows((prev) =>
      prev.map((r) => {
        const nextTimeByDate = { ...r.timeByDate };
        let changed = false;
        for (const d of ymds) {
          if (d in nextTimeByDate) {
            delete nextTimeByDate[d];
            changed = true;
          }
        }
        return changed ? { ...r, timeByDate: nextTimeByDate } : r;
      }),
    );
    setActiveDates((prev) => (prev.some((d) => toRemove.has(d)) ? [] : prev));
  };

  /** 날짜(또는 연속 구간) 칩을 탭하면 그 날짜들만의 시간을 따로 편집하는
   * 모드로 전환. 같은 칩을 다시 탭하면 기본 시간 편집으로 돌아간다. */
  const toggleActiveGroup = (group: string[]) =>
    setActiveDates((prev) =>
      prev.length === group.length && prev.every((d, i) => d === group[i])
        ? []
        : group,
    );

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
      const copy: PositionRow = {
        ...prev[idx]!,
        id: crypto.randomUUID(),
        timeByDate: { ...prev[idx]!.timeByDate },
      };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });

  const updatePositionLabel = (id: string, label: string) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label } : r)),
    );

  /** activeDates가 있으면 그 날짜들 전부에 같은 시간을, 없으면 기본
   * 시간(다른 날짜 전체 공통)을 바꾼다 */
  const updatePositionTime = (id: string, time: string) =>
    setPositionRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (activeDates.length > 0) {
          const nextTimeByDate = { ...r.timeByDate };
          for (const d of activeDates) nextTimeByDate[d] = time;
          return { ...r, timeByDate: nextTimeByDate };
        }
        return { ...r, time };
      }),
    );

  const updatePositionCapacity = (id: string, capacity: string) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, capacity } : r)),
    );

  const updatePositionTimeUndetermined = (id: string, timeUndetermined: boolean) =>
    setPositionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, timeUndetermined } : r)),
    );

  const timeForRow = (row: PositionRow) =>
    (activeDates.length > 0 ? row.timeByDate[activeDates[0]!] : undefined) ??
    row.time;

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

    // 연속된 날짜끼리는 같은 groupId로 묶어서, 신청 한 번으로 연일 전체에
    // 적용되게 한다 (연속이 아닌 날짜는 그룹 없이 각자 별도 신청).
    const dateGroupId = new Map<string, string>();
    for (const group of groupConsecutiveDates(dates)) {
      if (group.length <= 1) continue;
      const gid = crypto.randomUUID();
      for (const d of group) dateGroupId.set(d, gid);
    }

    const payload: Omit<EventItem, "id"> = useMultiplePositions
      ? (() => {
          const built = positionRows.map((row, idx) => {
            const posId = crypto.randomUUID();
            const slotId = crypto.randomUUID();
            const rowCap = Math.max(1, Number.parseInt(row.capacity, 10) || 0);
            const def: PositionDef = {
              id: posId,
              label: row.label.trim() || `포지션 ${idx + 1}`,
              capacity: rowCap,
              slots: [
                {
                  id: slotId,
                  time: row.timeUndetermined ? "" : row.time || "09:00",
                  capacity: rowCap,
                  applied_count: 0,
                  ...(row.timeUndetermined ? { timeUndetermined: true } : {}),
                },
              ],
            };
            return { row, posId, slotId, def };
          });

          return {
            title: title.trim(),
            venue: venue.trim(),
            team_ids: teamExposureToTeamIds(teamExposure),
            sessions: dates.map((d) => {
              const overrides: Record<string, string> = {};
              for (const { row, posId, slotId, def } of built) {
                if (row.timeUndetermined) continue;
                const override = row.timeByDate[d];
                if (override && override !== def.slots[0]!.time) {
                  overrides[positionSlotKey(posId, slotId)] = override;
                }
              }
              return {
                id: crypto.randomUUID(),
                date: d,
                slots: [],
                ...(dateGroupId.has(d) ? { groupId: dateGroupId.get(d)! } : {}),
                ...(Object.keys(overrides).length > 0
                  ? { positionSlotTimeOverrides: overrides }
                  : {}),
              };
            }),
            usePositions: true,
            positions: built.map((b) => b.def),
            forceApplyOpen: false,
          };
        })()
      : {
          title: title.trim(),
          venue: venue.trim(),
          team_ids: teamExposureToTeamIds(teamExposure),
          sessions: dates.map((d) => ({
            id: crypto.randomUUID(),
            date: d,
            ...(dateGroupId.has(d) ? { groupId: dateGroupId.get(d)! } : {}),
            slots: [
              {
                id: crypto.randomUUID(),
                start_time: positionRows[0]!.timeUndetermined
                  ? ""
                  : timeForRow(positionRows[0]!) || "09:00",
                capacity: Math.max(
                  1,
                  Number.parseInt(positionRows[0]!.capacity, 10) || 0,
                ),
                applied_count: 0,
                ...(positionRows[0]!.timeUndetermined
                  ? { timeUndetermined: true }
                  : {}),
              } satisfies Slot,
            ],
          })),
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
              노출 팀 *
            </label>
            <div className="flex gap-1.5">
              {TEAM_EXPOSURE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTeamExposure(opt.value)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    teamExposure === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-muted text-muted-foreground hover:border-accent/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
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
                {groupConsecutiveDates(dates).map((group) => {
                  const key = group.join(",");
                  const isActive =
                    activeDates.length === group.length &&
                    activeDates.every((d, i) => d === group[i]);
                  return (
                    <span
                      key={key}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs tabular-nums transition-colors",
                        isActive
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-muted text-foreground",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleActiveGroup(group)}
                        className="font-medium"
                        title={
                          group.length > 1
                            ? "탭하면 이 구간 전체를 다른 시간으로 설정"
                            : "탭하면 이 날짜만 다른 시간으로 설정"
                        }
                      >
                        {formatDateGroupLabel(group)}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDates(group)}
                        className={cn(
                          isActive
                            ? "text-accent/70 hover:text-red-600"
                            : "text-muted-foreground hover:text-red-600",
                        )}
                        aria-label={group.length > 1 ? "날짜 구간 삭제" : "날짜 삭제"}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                시작일만 입력하고 추가하면 하루만, 종료일까지 채우면 연속으로
                한 번에 추가됩니다.
              </p>
            )}
            {dates.length > 1 ? (
              <p className="text-[11px] text-muted-foreground">
                날짜(구간)를 탭하면 그 날짜만 다른 시간으로 설정할 수 있습니다.
                {activeDates.length > 0
                  ? ` 지금은 ${formatDateGroupLabel(activeDates)}의 시간만 편집 중.`
                  : " 지금은 모든 날짜에 적용되는 기본 시간을 편집 중."}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              포지션 · 시간 · 인원
              {activeDates.length > 0
                ? ` — ${formatDateGroupLabel(activeDates)}만 다르게`
                : ""}
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
                    <div className="min-w-0 space-y-1">
                      <Input
                        type="time"
                        step={60}
                        className="tabular-nums"
                        value={timeForRow(row)}
                        disabled={row.timeUndetermined}
                        onChange={(e) =>
                          updatePositionTime(row.id, e.target.value)
                        }
                      />
                      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={row.timeUndetermined}
                          onChange={(e) =>
                            updatePositionTimeUndetermined(
                              row.id,
                              e.target.checked,
                            )
                          }
                        />
                        시간 미정
                      </label>
                    </div>
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
