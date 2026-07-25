"use client";

import { useEffect, useState } from "react";

import type { EventItem, PositionDef, Session } from "@/types/schedule";
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

type SessionDraft = { id: string; date: string };

function emptySession(): SessionDraft {
  return { id: crypto.randomUUID(), date: "" };
}

export type CreateScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  /** 저장 시 완성된 이벤트(id 없음 — 부모에서 부여) */
  onSave: (payload: Omit<EventItem, "id">) => Promise<void>;
};

export function CreateScheduleDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: CreateScheduleDialogProps) {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [notice, setNotice] = useState("");
  const [color, setColor] = useState("#C8A96B");
  const [attendance, setAttendance] = useState<AttendanceSettings>({
    ...DEFAULT_ATTENDANCE_SETTINGS,
  });
  const [teamExposure, setTeamExposure] = useState<TeamExposure>("team_1");
  const [sessions, setSessions] = useState<SessionDraft[]>([emptySession()]);
  const [usePositions, setUsePositions] = useState(true);
  const [positions, setPositions] = useState<PositionDef[]>(DEFAULT_POSITIONS);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setVenue("");
    setNotice("");
    setColor("#C8A96B");
    setAttendance({ ...DEFAULT_ATTENDANCE_SETTINGS });
    setTeamExposure("team_1");
    setSessions([emptySession()]);
    setUsePositions(true);
    setPositions(DEFAULT_POSITIONS);
    setLocked(false);
    setError("");
  }, [open]);

  const addSession = () => setSessions((s) => [...s, emptySession()]);

  const removeSession = (sid: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((x) => x.id !== sid);
    });
  };

  const updateSessionDate = (sid: string, date: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, date } : s)),
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !venue.trim()) {
      setError("이벤트명과 장소는 필수입니다.");
      return;
    }
    for (const sess of sessions) {
      if (!sess.date) {
        setError("모든 세션에 날짜를 입력하세요.");
        return;
      }
    }
    if (usePositions) {
      const hasAnySlot = positions.some(
        (p) => p.label.trim() && p.slots.length > 0,
      );
      if (!hasAnySlot) {
        setError("포지션에 최소 1개 이상의 시간 슬롯을 추가하세요.");
        return;
      }
    }

    const builtSessions: Session[] = sessions.map((sess) => ({
      id: sess.id,
      date: sess.date,
      slots: [], // 포지션 기반 이벤트: 세션 슬롯 없음
    }));

    const payload: Omit<EventItem, "id"> = {
      title: title.trim(),
      venue: venue.trim(),
      team_ids: teamExposureToTeamIds(teamExposure),
      sessions: builtSessions,
      attendance,
      usePositions,
      positions: usePositions ? positions.filter((p) => p.label.trim()) : [],
      locked,
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">포지션 사용</p>
                <p className="text-xs text-muted-foreground">
                  포지션별·시간별로 신청을 받습니다
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={usePositions}
                onClick={() => setUsePositions((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  usePositions ? "bg-accent" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    usePositions ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {usePositions && (
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
            )}
          </div>

          <Separator />

          {/* 신청 잠금 설정 */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">신청 잠금</p>
              <p className="text-xs text-muted-foreground">
                활성화하면 팀원이 신청할 수 없습니다. 나중에 해제할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={locked}
              onClick={() => setLocked((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                locked ? "bg-blue-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  locked ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">날짜 · 슬롯</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addSession}
            >
              날짜 추가
            </Button>
          </div>

          {sessions.map((sess, si) => (
            <div
              key={sess.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-xs text-muted-foreground">날짜 *</label>
                <Input
                  type="date"
                  className="w-full"
                  value={sess.date}
                  onChange={(e) => updateSessionDate(sess.id, e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-400 shrink-0"
                disabled={sessions.length <= 1}
                onClick={() => removeSession(sess.id)}
              >
                삭제
              </Button>
              {si < sessions.length - 1 ? (
                <div className="w-full" />
              ) : null}
            </div>
          ))}
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
