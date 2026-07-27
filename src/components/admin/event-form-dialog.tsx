"use client";

import { useEffect, useState } from "react";

import { MultiDateCalendar } from "@/components/admin/multi-date-calendar";
import type { EventItem, EventPackage, PositionDef, Session } from "@/types/schedule";
import { DEFAULT_POSITIONS } from "@/types/schedule";
import {
  TEAM_EXPOSURE_OPTIONS,
  teamExposureToTeamIds,
  type TeamExposure,
} from "@/types/team";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
} from "@/types/attendance";
import { EventAttendanceSettingsFields } from "@/components/admin/event-attendance-settings-fields";
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
import { Separator } from "@/components/ui/separator";

type SessionDraft = { id: string; date: string; groupNum: string };

type PackageDraft = { id: string; label: string; startDate: string; endDate: string };

function emptyPackage(): PackageDraft {
  return { id: crypto.randomUUID(), label: "", startDate: "", endDate: "" };
}

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

export function CreateScheduleDialog({
  open,
  onOpenChange,
  saving,
  onSave,
  defaultDate,
}: CreateScheduleDialogProps) {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [notice, setNotice] = useState("");
  const [color, setColor] = useState("#C8A96B");
  const [attendance, setAttendance] = useState<AttendanceSettings>({
    ...DEFAULT_ATTENDANCE_SETTINGS,
  });
  const [teamExposure, setTeamExposure] = useState<TeamExposure>("team_1");
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [positions, setPositions] = useState<PositionDef[]>(DEFAULT_POSITIONS);
  const [packages, setPackages] = useState<PackageDraft[]>([]);
  const [forceApplyOpen, setForceApplyOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setNotice("");
    setColor("#C8A96B");
    setAttendance({ ...DEFAULT_ATTENDANCE_SETTINGS });
    setTeamExposure("team_1");
    setSessions(
      defaultDate
        ? [{ id: crypto.randomUUID(), date: defaultDate, groupNum: "" }]
        : [],
    );
    if (defaultDate) {
      const parts = defaultDate.split("-");
      setCalMonth(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
    } else {
      setCalMonth(new Date());
    }
    setPositions(DEFAULT_POSITIONS);
    setPackages([]);
    setForceApplyOpen(false);
    setError("");
  }, [open, defaultDate]);

  /** 캘린더 날짜 클릭 → 선택/해제 토글 */
  const toggleCalendarDate = (ymd: string) => {
    setSessions((prev) => {
      if (prev.some((s) => s.date === ymd)) {
        return prev.filter((s) => s.date !== ymd);
      }
      return [...prev, { id: crypto.randomUUID(), date: ymd, groupNum: "" }].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
    });
  };

  const updateSessionGroupNum = (sid: string, groupNum: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, groupNum } : s)),
    );
  };

  /** 선택된 날짜 Set (캘린더에 하이라이트 전달용) */
  const selectedDateSet = new Set(sessions.map((s) => s.date));

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !venue.trim()) {
      setError("이벤트명과 장소는 필수입니다.");
      return;
    }
    if (sessions.length === 0) {
      setError("날짜를 최소 1개 선택하세요.");
      return;
    }
    const hasAnyPackage = packages.some(
      (p) => p.label.trim() && p.startDate && p.endDate,
    );
    if (!hasAnyPackage) {
      // 패키지 없는 일반 이벤트는 슬롯 필수
      const hasAnySlot = positions.some(
        (p) => p.label.trim() && p.slots.length > 0,
      );
      if (!hasAnySlot) {
        setError("포지션에 최소 1개 이상의 시간 슬롯을 추가하거나, 기간 패키지를 정의하세요.");
        return;
      }
    }

    // 묶음 번호 → groupId UUID 변환
    const groupNumToId = new Map<string, string>();
    for (const sess of sessions) {
      const num = sess.groupNum.trim();
      if (num && !groupNumToId.has(num)) {
        groupNumToId.set(num, crypto.randomUUID());
      }
    }

    const builtSessions: Session[] = sessions.map((sess) => {
      const num = sess.groupNum.trim();
      return {
        id: sess.id,
        date: sess.date,
        slots: [],
        ...(num ? { groupId: groupNumToId.get(num) } : {}),
      };
    });

    const builtPackages: EventPackage[] = packages
      .filter((p) => p.label.trim() && p.startDate && p.endDate)
      .map((p) => ({ id: p.id, label: p.label.trim(), startDate: p.startDate, endDate: p.endDate }));

    const payload: Omit<EventItem, "id"> = {
      title: title.trim(),
      venue: venue.trim(),
      team_ids: teamExposureToTeamIds(teamExposure),
      sessions: builtSessions,
      attendance,
      usePositions: builtPackages.length === 0,
      positions: builtPackages.length === 0 ? positions.filter((p) => p.label.trim()) : [],
      forceApplyOpen,
      ...(builtPackages.length > 0 ? { packages: builtPackages } : {}),
    };
    if (notice.trim()) payload.notice = notice.trim();
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>스케줄 생성</DialogTitle>
          <DialogDescription>
            이벤트명, 장소, 날짜, 포지션별 시간·정원을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                노출 팀 *
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-muted px-3 text-sm"
                value={teamExposure}
                onChange={(e) => setTeamExposure(e.target.value as TeamExposure)}
              >
                {TEAM_EXPOSURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {teamExposure === "team_1" ? (
                <p className="text-xs text-muted-foreground">
                  1팀으로 등록하면 24시간 뒤 2팀도 자동으로 신청할 수 있습니다.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                이벤트명 *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: WDHL 인천지사"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                장소 *
              </label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="예: 인천"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                특이사항
              </label>
              <Textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="예: 검정 셔츠 착용"
                className="min-h-[72px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                표시 색상
              </label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="h-9 w-14 cursor-pointer p-1"
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

          <EventAttendanceSettingsFields
            value={attendance}
            onChange={setAttendance}
          />

          <Separator />

          {/* 포지션 설정 (Option B: 포지션 → 시간슬롯) */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">포지션 사용</p>
              <p className="text-xs text-muted-foreground">
                포지션별·시간별로 신청을 받습니다
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              {positions.map((pos, idx) => (
                <div key={pos.id} className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                  {/* 포지션 이름 행 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-12 shrink-0">포지션</span>
                    <Input
                      className="flex-1 text-sm h-8"
                      placeholder="예: 딜러"
                      value={pos.label}
                      onChange={(e) =>
                        setPositions((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, label: e.target.value } : p,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-red-400 px-1"
                      onClick={() =>
                        setPositions((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      ×
                    </button>
                  </div>
                  {/* 시간슬롯 목록 */}
                  <div className="space-y-1.5 pl-14">
                    {(pos.slots ?? []).map((slot, si) => (
                      <div key={slot.id} className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={60}
                          className="w-28 h-8 text-sm tabular-nums"
                          value={slot.time}
                          onChange={(e) =>
                            setPositions((prev) =>
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
                          type="text"
                          inputMode="numeric"
                          className="w-20 h-8 text-sm"
                          placeholder="정원"
                          value={slot.capacity === 0 ? "" : String(slot.capacity)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const val = raw === "" ? 0 : Math.min(9999, Number.parseInt(raw, 10));
                            setPositions((prev) =>
                              prev.map((p, i) =>
                                i !== idx ? p : {
                                  ...p,
                                  slots: p.slots.map((s, j) =>
                                    j === si ? { ...s, capacity: val } : s,
                                  ),
                                },
                              ),
                            );
                          }}
                          onBlur={() => {
                            if (slot.capacity < 1) {
                              setPositions((prev) =>
                                prev.map((p, i) =>
                                  i !== idx ? p : {
                                    ...p,
                                    slots: p.slots.map((s, j) =>
                                      j === si ? { ...s, capacity: 1 } : s,
                                    ),
                                  },
                                ),
                              );
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">명</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-red-400"
                          onClick={() =>
                            setPositions((prev) =>
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
                        setPositions((prev) =>
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
                  setPositions((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), label: "", capacity: 0, slots: [] },
                  ])
                }
              >
                + 포지션 추가
              </Button>
            </div>
          </div>

          <Separator />

          {/* 상시 신청 허용 설정 */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">상시 신청 허용</p>
              <p className="text-xs text-muted-foreground">
                활성화하면 신청기간이 아니어도 항상 신청을 받습니다. 중요 일정에
                긴급하게 신청을 받고 싶을 때 사용하세요. 언제든 꺼서 다시
                신청기간 기준으로 되돌릴 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={forceApplyOpen}
              onClick={() => setForceApplyOpen((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                forceApplyOpen ? "bg-violet-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  forceApplyOpen ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <Separator />

          {/* 기간 패키지 (선택) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">기간 패키지 (선택)</p>
                <p className="text-xs text-muted-foreground">
                  10일 이벤트에서 5일·7일·전체처럼 신청 기간을 나눌 때 사용합니다
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPackages((prev) => [...prev, emptyPackage()])}
              >
                + 패키지 추가
              </Button>
            </div>
            {packages.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card px-3 py-2.5">
                    <div className="w-20 space-y-1 shrink-0">
                      <label className="text-[10px] text-muted-foreground">라벨</label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="5일"
                        value={pkg.label}
                        onChange={(e) =>
                          setPackages((prev) =>
                            prev.map((p) => p.id === pkg.id ? { ...p, label: e.target.value } : p),
                          )
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] space-y-1">
                      <label className="text-[10px] text-muted-foreground">시작일</label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={pkg.startDate}
                        onChange={(e) =>
                          setPackages((prev) =>
                            prev.map((p) => p.id === pkg.id ? { ...p, startDate: e.target.value } : p),
                          )
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] space-y-1">
                      <label className="text-[10px] text-muted-foreground">종료일</label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={pkg.endDate}
                        onChange={(e) =>
                          setPackages((prev) =>
                            prev.map((p) => p.id === pkg.id ? { ...p, endDate: e.target.value } : p),
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-400 shrink-0 h-8"
                      onClick={() => setPackages((prev) => prev.filter((p) => p.id !== pkg.id))}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium">날짜 · 슬롯</p>
            <p className="text-xs text-muted-foreground">
              {defaultDate
                ? "지정된 날짜로 생성됩니다"
                : "캘린더에서 날짜를 클릭해 선택하세요 (복수 선택 가능)"}
            </p>
          </div>

          {defaultDate ? (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">날짜</p>
              <p className="text-sm font-medium">{defaultDate}</p>
            </div>
          ) : (
            <>
              <MultiDateCalendar
                month={calMonth}
                onMonthChange={setCalMonth}
                selectedDates={selectedDateSet}
                onToggleDate={toggleCalendarDate}
              />

              {sessions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    선택된 날짜 ({sessions.length}개) — 재클릭으로 해제
                  </p>
                  {sessions.map((sess) => {
                    const parts = sess.date.split("-");
                    const dateObj = new Date(
                      Number(parts[0]),
                      Number(parts[1]) - 1,
                      Number(parts[2]),
                    );
                    const dow = ["일", "월", "화", "수", "목", "금", "토"][
                      dateObj.getDay()
                    ];
                    return (
                      <div
                        key={sess.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                      >
                        <span className="flex-1 text-sm font-medium tabular-nums">
                          {parts[1]}/{parts[2]} ({dow})
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="text-[10px] text-muted-foreground whitespace-nowrap">
                            묶음 #
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="—"
                            className="h-8 w-14 text-center text-sm"
                            value={sess.groupNum}
                            onChange={(e) =>
                              updateSessionGroupNum(
                                sess.id,
                                e.target.value.replace(/[^0-9]/g, ""),
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  위 캘린더에서 날짜를 선택하세요
                </p>
              )}
            </>
          )}
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
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
