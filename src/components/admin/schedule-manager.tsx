"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import type { EventItem } from "@/types/schedule";
import { CreateScheduleDialog } from "@/components/admin/event-form-dialog";
import { SessionScheduleSheetBody } from "@/components/admin/session-schedule-sheet-body";
import { deleteEvent, saveEvent } from "@/lib/firestore-events";
import { useEvents } from "@/hooks/use-events";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function ScheduleManager() {
  const { events, loading, error } = useEvents();
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [sheetEditorKey, setSheetEditorKey] = useState(0);
  const [detailCtx, setDetailCtx] = useState<{
    date: string;
    event: EventItem;
    session: EventItem["sessions"][0];
  } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { event: EventItem; session: EventItem["sessions"][0] }[]
    >();
    for (const event of events) {
      for (const session of event.sessions) {
        const list = map.get(session.date) ?? [];
        list.push({ event, session });
        map.set(session.date, list);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

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
    setSaving(true);
    try {
      await saveEvent({ ...payload, id });
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
            날짜별 그룹에서 세션을 눌러 편집합니다. 기본 정보·슬롯·세션 날짜를 한곳에서
            관리합니다.
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
          날짜별 세션
        </h3>
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {events.length === 0 && !loading
                ? "등록된 일정이 없습니다.「스케줄 생성」으로 추가하세요."
                : "표시할 세션이 없습니다. 이벤트에 날짜(세션)를 추가하세요."}
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
