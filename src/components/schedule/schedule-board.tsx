"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { EventItem, Session } from "@/types/schedule";
import { MiniCalendar, toYMD } from "@/components/schedule/mini-calendar";
import {
  ApplySlotContext,
  ApplySlotSurface,
} from "@/components/schedule/apply-slot";
import { useMyApplications } from "@/hooks/use-my-applications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function useMarkedDates(events: EventItem[]) {
  return useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) {
      for (const sess of ev.sessions) {
        s.add(sess.date);
      }
    }
    return s;
  }, [events]);
}

function sessionsForDate(events: EventItem[], ymd: string) {
  const out: { event: EventItem; session: Session }[] = [];
  for (const ev of events) {
    for (const sess of ev.sessions) {
      if (sess.date === ymd) out.push({ event: ev, session: sess });
    }
  }
  return out;
}

export function ScheduleBoard({ events }: { events: EventItem[] }) {
  const [month, setMonth] = useState(() => new Date(2026, 4, 1));
  const [selected, setSelected] = useState(() => new Date(2026, 4, 7));
  const [openEv, setOpenEv] = useState<Record<string, boolean>>({});

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCtx, setApplyCtx] = useState<ApplySlotContext | null>(null);
  const { items: myApplications } = useMyApplications();

  const marked = useMarkedDates(events);
  const ymd = toYMD(selected);
  const rows = sessionsForDate(events, ymd);
  const appliedEventIds = useMemo(() => {
    const set = new Set<string>();
    for (const app of myApplications) {
      if (
        (app.status === "pending" ||
          app.status === "approved" ||
          app.status === "completed") &&
        app.eventId
      ) {
        set.add(app.eventId);
      }
    }
    return set;
  }, [myApplications]);

  const toggleEvent = (id: string) => {
    setOpenEv((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px),1fr]">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">월간 달력</h2>
          <p className="text-sm text-muted-foreground">
            날짜를 선택하면 우측에서 해당 일정을 확인하고 바로 신청할 수 있습니다.
          </p>
        <MiniCalendar
          month={month}
          selected={selected}
          onMonthChange={setMonth}
          onSelect={setSelected}
          markedDates={marked}
          mode="full"
        />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                선택한 날짜
              </h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {ymd}
              </p>
            </div>
            <Badge variant="accent" className="tabular-nums">
              일정 {rows.length}건
            </Badge>
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                이 날짜에 등록된 이벤트가 없습니다.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map(({ event, session }) => {
                const expanded = openEv[event.id] ?? true;
                return (
                  <Card
                    key={`${event.id}-${session.id}`}
                    className={cn(
                      "overflow-hidden",
                      event.color && "border-l-[3px]",
                    )}
                    style={
                      event.color
                        ? { borderLeftColor: event.color }
                        : undefined
                    }
                  >
                    <CardHeader className="pb-3">
                      <button
                        type="button"
                        onClick={() => toggleEvent(event.id)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{event.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {event.venue}
                          </CardDescription>
                          {event.notice ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {event.notice}
                            </p>
                          ) : null}
                        </div>
                        <ChevronDown
                          className={cn(
                            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                      </button>
                    </CardHeader>
                    {expanded && (
                      <CardContent className="space-y-2 border-t border-border bg-muted/30 px-5 py-4">
                        <p className="text-xs text-muted-foreground">
                          거절 처리된 신청은 같은 이벤트에 다시 신청할 수 있습니다.
                        </p>
                        {session.slots.map((slot) => {
                          const full = slot.applied_count >= slot.capacity;
                          const alreadyAppliedEvent = appliedEventIds.has(event.id);
                          const blocked = full || alreadyAppliedEvent;
                          return (
                            <div
                              key={slot.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                            >
                              <div className="text-sm tabular-nums">
                                <span className="font-medium text-foreground">
                                  {slot.start_time}
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                  정원 {slot.applied_count}/{slot.capacity}
                                </span>
                                {full && (
                                  <Badge variant="warning" className="ml-2">
                                    마감
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant={blocked ? "outline" : "accent"}
                                disabled={blocked}
                                onClick={() => {
                                  setApplyCtx({
                                    eventId: event.id,
                                    sessionId: session.id,
                                    slotId: slot.id,
                                    eventTitle: event.title,
                                    venue: event.venue,
                                    date: session.date,
                                    slotStart: slot.start_time,
                                    capacity: slot.capacity,
                                    applied: slot.applied_count,
                                  });
                                  setApplyOpen(true);
                                }}
                              >
                                {alreadyAppliedEvent ? "신청 완료" : full ? "마감" : "신청"}
                              </Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ApplySlotSurface
        open={applyOpen}
        onOpenChange={setApplyOpen}
        ctx={applyCtx}
      />
    </div>
  );
}
