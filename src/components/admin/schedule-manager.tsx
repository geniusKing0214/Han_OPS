"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";

import type { EventItem } from "@/types/schedule";
import { CreateScheduleDialog } from "@/components/admin/event-form-dialog";
import { deleteEvent, saveEvent } from "@/lib/firestore-events";
import { updateSlot } from "@/lib/schedule-mutations";
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
import { Input } from "@/components/ui/input";

function parsePositiveInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function openEventEditorInNewWindow(eventId: string) {
  const path = `/admin/schedule/${encodeURIComponent(eventId)}`;
  window.open(path, "_blank", "noopener,noreferrer");
}

function SheetDetailBody({
  detailCtx,
  events,
  saving,
  onPersist,
}: {
  detailCtx: {
    date: string;
    event: EventItem;
    session: EventItem["sessions"][0];
  };
  events: EventItem[];
  saving: boolean;
  onPersist: (next: EventItem) => Promise<void>;
}) {
  const live = events.find((e) => e.id === detailCtx.event.id);
  const session = live?.sessions.find((s) => s.id === detailCtx.session.id);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{detailCtx.event.title}</SheetTitle>
        <SheetDescription>{detailCtx.event.venue}</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-3 text-sm">
        {detailCtx.event.color ? (
          <div
            className="h-1 w-full rounded-full"
            style={{ backgroundColor: detailCtx.event.color }}
          />
        ) : null}
        {detailCtx.event.notice ? (
          <p className="text-muted-foreground">{detailCtx.event.notice}</p>
        ) : null}
        <p className="font-medium tabular-nums text-foreground">{detailCtx.date}</p>
        {!live || !session ? (
          <p className="border-t border-border pt-3 text-muted-foreground">
            일정이 삭제되었거나 동기화 중입니다. 창을 닫았다가 다시 열어 보세요.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              각 슬롯의 모집 인원(정원)과 신청 인원을 바로 수정할 수 있습니다.
            </p>
            <div className="space-y-3 border-t border-border pt-3">
              {session.slots.map((sl) => (
                <div
                  key={sl.id}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <p className="mb-2 font-medium tabular-nums">{sl.start_time}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">
                        모집 인원 (정원)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={sl.capacity}
                        disabled={saving}
                        onChange={(e) =>
                          void onPersist(
                            updateSlot(live, session.id, sl.id, {
                              capacity: parsePositiveInt(
                                e.target.value,
                                sl.capacity,
                              ),
                            }),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">
                        신청 인원
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={sl.applied_count}
                        disabled={saving}
                        onChange={(e) =>
                          void onPersist(
                            updateSlot(live, session.id, sl.id, {
                              applied_count: parsePositiveInt(
                                e.target.value,
                                sl.applied_count,
                              ),
                            }),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function ScheduleManager() {
  const { events, loading, error } = useEvents();
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
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

  const handleDeleteEvent = async (ev: EventItem) => {
    if (
      !confirm(
        `"${ev.title}" 일정을 삭제할까요? 세션·슬롯 데이터도 함께 삭제됩니다.`,
      )
    )
      return;
    setSaving(true);
    try {
      await deleteEvent(ev.id);
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
            이벤트별 상세 편집은 새 창에서 열 수 있습니다. Firestore와 사용자
            Schedule 화면이 동기화됩니다.
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
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detailCtx ? (
            <SheetDetailBody
              detailCtx={detailCtx}
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
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {loading ? (
        <p className="text-sm text-muted-foreground">일정 불러오는 중...</p>
      ) : null}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          이벤트별 편집
        </h3>
        {events.length === 0 && !loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              등록된 일정이 없습니다.「스케줄 생성」으로 추가하세요.
            </CardContent>
          </Card>
        ) : (
          events.map((ev) => {
            const sessionCount = ev.sessions.length;
            const slotCount = ev.sessions.reduce(
              (acc, s) => acc + s.slots.length,
              0,
            );
            return (
              <Card key={ev.id}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {ev.color ? (
                        <span
                          className="inline-block size-3 shrink-0 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: ev.color }}
                        />
                      ) : null}
                      <CardTitle className="text-base">{ev.title}</CardTitle>
                    </div>
                    <CardDescription>{ev.venue}</CardDescription>
                    {ev.notice ? (
                      <p className="mt-2 text-xs text-muted-foreground">{ev.notice}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      className="gap-1.5"
                      disabled={saving}
                      onClick={() => openEventEditorInNewWindow(ev.id)}
                    >
                      <ExternalLink className="size-3.5" />
                      새 창에서 편집
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => void handleDeleteEvent(ev)}
                      disabled={saving}
                    >
                      <Trash2 className="size-3.5" />
                      삭제
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    세션 {sessionCount}개 · 슬롯 {slotCount}개
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          날짜별 그룹
        </h3>
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            표시할 세션이 없습니다.
          </p>
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
                      setDetailOpen(true);
                    }}
                    className="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.venue}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      슬롯 {session.slots.length}개 · 탭하여 상세
                    </p>
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
