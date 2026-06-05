"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type { EventItem } from "@/types/schedule";
import { CreateScheduleDialog } from "@/components/admin/event-form-dialog";
import { SessionScheduleSheetBody } from "@/components/admin/session-schedule-sheet-body";
import { TeamFilter } from "@/components/team/team-filter";
import { deleteEvent, createScheduleEvent, saveEvent } from "@/lib/firestore-events";
import { useAuth } from "@/components/providers/auth-provider";
import { useEvents } from "@/hooks/use-events";
import { filterEventsByTeamFilter } from "@/lib/team-utils";
import type { TeamFilterValue } from "@/types/team";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatTeamIdsLabel } from "@/types/team";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function ScheduleManager() {
  const { user } = useAuth();
  const { events, loading, error } = useEvents();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [sheetEditorKey, setSheetEditorKey] = useState(0);
  const [detailCtx, setDetailCtx] = useState<{
    date: string;
    event: EventItem;
    session: EventItem["sessions"][0];
  } | null>(null);

  const teamFilteredEvents = useMemo(
    () => filterEventsByTeamFilter(events, teamFilter),
    [events, teamFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { event: EventItem; session: EventItem["sessions"][0] }[]
    >();
    for (const event of teamFilteredEvents) {
      for (const session of event.sessions) {
        if (!session.date.startsWith(monthKey)) continue;
        const list = map.get(session.date) ?? [];
        list.push({ event, session });
        map.set(session.date, list);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [teamFilteredEvents, monthKey]);

  const monthStats = useMemo(() => {
    const sessionCount = grouped.reduce((sum, [, rows]) => sum + rows.length, 0);
    return { dayCount: grouped.length, sessionCount };
  }, [grouped]);

  const handleDeleteEventFromSheet = async () => {
    if (!detailCtx) return;
    if (
      !confirm(
        `"${detailCtx.event.title}" 일정을 삭제할까요? 세션·슬롯·관련 신청도 함께 삭제됩니다.`,
      )
    )
      return;
    setSaving(true);
    try {
      await deleteEvent(detailCtx.event.id);
      setDetailOpen(false);
      setDetailCtx(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSave = async (payload: Omit<EventItem, "id">) => {
    const id = crypto.randomUUID();
    if (!user) throw new Error("로그인이 필요합니다.");
    setSaving(true);
    try {
      await createScheduleEvent({ ...payload, id }, user.uid);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Schedule Manager</h2>
          <p className="text-sm text-muted-foreground">
            월별로 세션을 확인하고, 날짜별 그룹에서 탭하여 편집합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          className="gap-2"
          onClick={() => setCreateOpen(true)}
          disabled={saving}
        >
          <Plus className="size-4" />
          스케줄 생성
        </Button>
      </div>

      <CreateScheduleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        saving={saving}
        onSave={handleCreateSave}
      />

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          일정 로드 오류: {error}
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <TeamFilter value={teamFilter} onChange={setTeamFilter} />
          <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="이전 달"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="h-9 w-[9.5rem] shrink-0 tabular-nums sm:w-40"
            aria-label="월 선택"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="다음 달"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{formatMonthLabel(monthKey)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {monthStats.dayCount}일 · {monthStats.sessionCount}개 세션
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setMonthKey(currentMonthKey())}
          >
            이번 달
          </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailCtx(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {!detailCtx ? (
            <>
              <SheetHeader>
                <SheetTitle>편집</SheetTitle>
                <SheetDescription>세션을 선택하세요.</SheetDescription>
              </SheetHeader>
            </>
          ) : (
            <SessionScheduleSheetBody
              resetKey={sheetEditorKey}
              eventId={detailCtx.event.id}
              sessionId={detailCtx.session.id}
              events={events}
              saving={saving}
              onPersist={async (next) => {
                setSaving(true);
                try {
                  await saveEvent(next);
                } finally {
                  setSaving(false);
                }
              }}
              onDeleteEvent={() => handleDeleteEventFromSheet()}
              onClose={() => {
                setDetailOpen(false);
                setDetailCtx(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {loading ? (
        <p className="text-sm text-muted-foreground">일정 불러오는 중...</p>
      ) : null}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {formatMonthLabel(monthKey)} · 날짜별 세션
        </h3>
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {events.length === 0 && !loading
                ? "등록된 일정이 없습니다.「스케줄 생성」으로 추가하세요."
                : `${formatMonthLabel(monthKey)}에 표시할 세션이 없습니다. 다른 달을 선택하거나 이벤트에 세션을 추가하세요.`}
            </CardContent>
          </Card>
        ) : (
          grouped.map(([date, rows]) => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="text-base tabular-nums">{date}</CardTitle>
                <CardDescription>{rows.length}개 세션</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.map(({ event, session }) => (
                  <button
                    key={`${event.id}-${session.id}`}
                    type="button"
                    onClick={() => {
                      setDetailCtx({ date, event, session });
                      setSheetEditorKey((k) => k + 1);
                      setDetailOpen(true);
                    }}
                    className="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-2">
                      {event.color ? (
                        <span
                          className="mt-1 inline-block size-2.5 shrink-0 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: event.color }}
                          aria-hidden
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.venue}</p>
                            <Badge variant="outline" className="mt-1.5 text-[10px]">
                              {formatTeamIdsLabel(event.team_ids ?? ["team_1"])}
                            </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          슬롯 {session.slots.length}개 · 탭하여 편집
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
