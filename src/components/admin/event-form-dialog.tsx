"use client";

import { useEffect, useState } from "react";

import type { EventItem, Session, Slot } from "@/types/schedule";
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

type SlotDraft = { id: string; start_time: string; capacity: string };
type SessionDraft = { id: string; date: string; slots: SlotDraft[] };

function emptySession(): SessionDraft {
  return {
    id: crypto.randomUUID(),
    date: "",
    slots: [{ id: crypto.randomUUID(), start_time: "09:00", capacity: "1" }],
  };
}

function parsePositiveInt(v: string, fallback: number) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
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

  const addSlot = (sid: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              slots: [
                ...s.slots,
                { id: crypto.randomUUID(), start_time: "09:00", capacity: "1" },
              ],
            }
          : s,
      ),
    );
  };

  const removeSlot = (sid: string, slotId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s;
        if (s.slots.length <= 1) return s;
        return { ...s, slots: s.slots.filter((sl) => sl.id !== slotId) };
      }),
    );
  };

  const updateSlot = (
    sid: string,
    slotId: string,
    patch: Partial<Pick<SlotDraft, "start_time" | "capacity">>,
  ) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s;
        return {
          ...s,
          slots: s.slots.map((sl) =>
            sl.id === slotId ? { ...sl, ...patch } : sl,
          ),
        };
      }),
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
      for (const sl of sess.slots) {
        if (!sl.start_time) {
          setError("모든 슬롯에 시작 시간을 입력하세요.");
          return;
        }
        const cap = parsePositiveInt(sl.capacity, 0);
        if (cap < 1) {
          setError("정원은 1 이상이어야 합니다.");
          return;
        }
      }
    }

    const builtSessions: Session[] = sessions.map((sess) => ({
      id: sess.id,
      date: sess.date,
      slots: sess.slots.map(
        (sl): Slot => ({
          id: sl.id,
          start_time: sl.start_time,
          capacity: parsePositiveInt(sl.capacity, 1),
          applied_count: 0,
        }),
      ),
    }));

    const payload: Omit<EventItem, "id"> = {
      title: title.trim(),
      venue: venue.trim(),
      team_ids: teamExposureToTeamIds(teamExposure),
      sessions: builtSessions,
      attendance,
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
            필수: 날짜, 이벤트명, 장소, 시간, 정원 · 특이사항은 선택입니다.
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
              className="rounded-lg border border-border bg-muted/30 p-4"
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    날짜 *
                  </label>
                  <Input
                    type="date"
                    className="w-[180px]"
                    value={sess.date}
                    onChange={(e) => updateSessionDate(sess.id, e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  disabled={sessions.length <= 1}
                  onClick={() => removeSession(sess.id)}
                >
                  이 날짜 삭제
                </Button>
              </div>

              <div className="space-y-2">
                {sess.slots.map((sl) => (
                  <div
                    key={sl.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-end"
                  >
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">
                          시작 *
                        </span>
                        <Input
                          type="time"
                          value={sl.start_time}
                          onChange={(e) =>
                            updateSlot(sess.id, sl.id, {
                              start_time: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">
                          정원 *
                        </span>
                        <Input
                          type="number"
                          min={1}
                          value={sl.capacity}
                          onChange={(e) =>
                            updateSlot(sess.id, sl.id, {
                              capacity: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={sess.slots.length <= 1}
                      onClick={() => removeSlot(sess.id, sl.id)}
                    >
                      슬롯 삭제
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  className="w-full sm:w-auto"
                  onClick={() => addSlot(sess.id)}
                >
                  시간 슬롯 추가
                </Button>
              </div>
              {si < sessions.length - 1 ? <Separator className="my-4" /> : null}
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
