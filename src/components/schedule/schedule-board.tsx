"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { EventItem, EventPackage, Session } from "@/types/schedule";
import type { TeamId } from "@/types/team";
import { MiniCalendar, toYMD } from "@/components/schedule/mini-calendar";
import { buildSessionDateMarkers } from "@/lib/schedule-calendar-markers";
import Link from "next/link";
import {
  EVENT_APPLY_WINDOW_BADGE_CLASS,
  EVENT_APPLY_WINDOW_LABEL,
  canTeamApplyNow,
  formatTeam2ApplyCountdown,
  formatTeam2ApplyOpensAt,
  resolveEventApplyStatus,
  hasTeam2Stagger,
} from "@/lib/application-window";
import {
  ApplySlotContext,
  ApplySlotSurface,
} from "@/components/schedule/apply-slot";
import { useMyApplications } from "@/hooks/use-my-applications";
import { useMyAvailability } from "@/hooks/use-my-availability";
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

/** 패키지의 startDate~endDate 사이 모든 날짜 배열 생성 */
function expandPackageDates(pkg: EventPackage): string[] {
  const dates: string[] = [];
  const cur = new Date(pkg.startDate + "T00:00:00");
  const end = new Date(pkg.endDate + "T00:00:00");
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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

/** 같은 이벤트 내에서 동일 groupId를 가진 모든 세션 (날짜순 정렬) */
function groupSessionsFor(event: EventItem, groupId: string): Session[] {
  return event.sessions
    .filter((s) => s.groupId === groupId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function groupDateLabel(groupSessions: Session[]): string {
  const dates = groupSessions.map((s) => s.date).sort();
  if (dates.length === 0) return "";
  if (dates.length === 1) return dates[0];
  return `${dates[0]} ~ ${dates[dates.length - 1]} (${dates.length}일)`;
}

export function ScheduleBoard({
  events,
  memberTeamId,
}: {
  events: EventItem[];
  memberTeamId?: TeamId;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date());
  const [openEv, setOpenEv] = useState<Record<string, boolean>>({});

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCtx, setApplyCtx] = useState<ApplySlotContext | null>(null);
  const { items: myApplications } = useMyApplications();
  const { avail: myAvailability } = useMyAvailability();

  const dateMarkers = useMemo(() => buildSessionDateMarkers(events), [events]);
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
            dateMarkers={dateMarkers}
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
              {(() => {
                const renderedGroupKeys = new Set<string>();
                return rows.map(({ event, session }) => {
                // 그룹 세션: 같은 groupId가 이미 렌더됐으면 건너뜀
                const groupKey = session.groupId ? `${event.id}:${session.groupId}` : null;
                if (groupKey) {
                  if (renderedGroupKeys.has(groupKey)) return null;
                  renderedGroupKeys.add(groupKey);
                }
                // 그룹 세션 전체 정보 계산
                const groupSessions = session.groupId
                  ? groupSessionsFor(event, session.groupId)
                  : null;
                const isGroup = !!groupSessions && groupSessions.length > 1;
                const primarySession = isGroup ? groupSessions[0] : session;

                const expanded = openEv[event.id] ?? true;
                const teamApplyLocked =
                  memberTeamId === "team_2" &&
                  hasTeam2Stagger(event) &&
                  !canTeamApplyNow(event, "team_2");
                const team2Countdown = teamApplyLocked
                  ? formatTeam2ApplyCountdown(event)
                  : null;
                const team2OpensLabel = teamApplyLocked
                  ? formatTeam2ApplyOpensAt(event)
                  : null;
                const windowStatus = resolveEventApplyStatus(
                  primarySession.date,
                  myAvailability,
                );
                // locked===false: 어드민이 명시적으로 잠금 해제 → 윈도우 체크 우회
                const windowOpen = event.locked === false ? true : windowStatus === "open";
                return (
                  <Card
                    key={groupKey ?? `${event.id}-${session.id}`}
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
                          <CardTitle className="text-base">
                            {event.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {event.venue}
                          </CardDescription>
                          {isGroup && groupSessions ? (
                            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-blue-300 ring-1 ring-blue-500/25">
                              {groupDateLabel(groupSessions)}
                            </p>
                          ) : null}
                          {event.notice ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {event.notice}
                            </p>
                          ) : null}
                          {event.closed ? (
                            <p className="mt-2 text-xs font-semibold text-red-400">
                              신청 마감
                            </p>
                          ) : event.locked ? (
                            <p className="mt-2 text-xs font-semibold text-blue-400">
                              신청 잠금
                            </p>
                          ) : teamApplyLocked ? (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                              2팀 신청 대기 ·{" "}
                              {team2Countdown ??
                                (team2OpensLabel
                                  ? `${team2OpensLabel}부터 신청 가능`
                                  : "1팀 등록 24시간 후 신청 가능")}
                            </p>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  EVENT_APPLY_WINDOW_BADGE_CLASS[windowStatus],
                                )}
                              >
                                {EVENT_APPLY_WINDOW_LABEL[windowStatus]}
                              </span>
                              {windowStatus === "blocked" ? (
                                <Link
                                  href="/my-availability"
                                  className="text-xs text-accent underline-offset-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  익주 근무 가능일 먼저 제출하기
                                </Link>
                              ) : null}
                            </div>
                          )}
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
                        {/* 기간 패키지 표시 */}
                        {event.packages && event.packages.length > 0 ? (
                          <div className="space-y-2">
                            {event.packages.map((pkg) => {
                              const pkgDates = expandPackageDates(pkg);
                              const alreadyAppliedEvent = appliedEventIds.has(event.id);
                              return (
                                <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
                                  <div className="text-sm">
                                    <span className="font-semibold text-foreground">{pkg.label}</span>
                                    <span className="ml-2 tabular-nums text-muted-foreground text-xs">
                                      {pkg.startDate} ~ {pkg.endDate} ({pkgDates.length}일)
                                    </span>
                                  </div>
                                  {event.closed ? (
                                    <Button size="sm" variant="outline" disabled>신청 마감</Button>
                                  ) : event.locked ? (
                                    <Button size="sm" variant="outline" disabled>신청 잠금</Button>
                                  ) : alreadyAppliedEvent ? (
                                    <Button size="sm" variant="outline" disabled>신청 완료</Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="accent"
                                      onClick={() => {
                                        // 패키지의 첫 세션을 기준 sessionId로 사용
                                        const firstSession = event.sessions
                                          .filter((s) => pkgDates.includes(s.date))
                                          .sort((a, b) => a.date.localeCompare(b.date))[0];
                                        setApplyCtx({
                                          eventId: event.id,
                                          sessionId: firstSession?.id ?? "",
                                          eventTitle: event.title,
                                          venue: event.venue,
                                          date: pkg.startDate,
                                          packageId: pkg.id,
                                          packageLabel: pkg.label,
                                          packageDates: pkgDates,
                                        });
                                        setApplyOpen(true);
                                      }}
                                    >
                                      신청
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        {/* Option B: 포지션 기반 표시 (패키지 없는 경우에만) */}
                        {!event.packages?.length && event.usePositions && event.positions && event.positions.length > 0 ? (
                          <div className="space-y-2">
                            {event.positions!.map((pos) => {
                              const alreadyAppliedEvent = appliedEventIds.has(event.id);
                              const hasSlots = pos.slots && pos.slots.length > 0;
                              return (
                                <div key={pos.id} className="rounded-md border border-border bg-card px-3 py-2.5 space-y-2">
                                  <p className="text-xs font-semibold text-foreground">{pos.label}</p>
                                  {hasSlots ? (
                                    <>
                                      <div className="flex flex-wrap gap-2">
                                        {pos.slots.map((slot) => {
                                          const slotRemaining = Math.max(0, slot.capacity - slot.applied_count);
                                          const full = slotRemaining === 0;
                                          return (
                                            <div key={slot.id} className="flex items-center gap-1.5">
                                              <span className="text-xs tabular-nums text-muted-foreground">
                                                {slot.time}
                                                <span className="ml-1 opacity-70">
                                                  {full ? "마감" : `잔여${slotRemaining}/${slot.capacity}`}
                                                </span>
                                              </span>
                                              {full && <Badge variant="warning" className="text-[10px] px-1.5 py-0">마감</Badge>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {/* 이 포지션에 열린 슬롯이 하나라도 있으면 신청 버튼 */}
                                      {event.closed ? (
                                        <Button size="sm" variant="outline" disabled className="w-full">신청 마감</Button>
                                      ) : event.locked ? (
                                        <Button size="sm" variant="outline" disabled className="w-full">신청 잠금</Button>
                                      ) : !alreadyAppliedEvent && !teamApplyLocked && windowOpen &&
                                      pos.slots.some((s) => s.applied_count < s.capacity) ? (
                                        <Button
                                          size="sm"
                                          variant="accent"
                                          className="w-full"
                                          onClick={() => {
                                            setApplyCtx({
                                              eventId: event.id,
                                              sessionId: primarySession.id,
                                              eventTitle: event.title,
                                              venue: event.venue,
                                              date: primarySession.date,
                                              usePositions: true,
                                              positions: event.positions,
                                              ...(isGroup && session.groupId ? {
                                                groupId: session.groupId,
                                                groupDates: groupSessions!.map((s) => s.date),
                                                groupSessionIds: groupSessions!.map((s) => s.id),
                                              } : {}),
                                            });
                                            setApplyOpen(true);
                                          }}
                                        >
                                          신청
                                        </Button>
                                      ) : alreadyAppliedEvent ? (
                                        <Button size="sm" variant="outline" disabled className="w-full">신청 완료</Button>
                                      ) : null}
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">시간 슬롯 준비 중</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : !event.packages?.length ? (
                          /* 기존: 일반 슬롯 표시 */
                          <div className="space-y-2">
                            {session.slots.map((slot) => {
                              const full = slot.applied_count >= slot.capacity;
                              const alreadyAppliedEvent = appliedEventIds.has(event.id);
                              const blocked = full || alreadyAppliedEvent || teamApplyLocked || !!event.closed || !!event.locked || !windowOpen;
                              return (
                                <div
                                  key={slot.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                                >
                                  <div className="text-sm tabular-nums">
                                    <span className="font-medium text-foreground">{slot.start_time}</span>
                                    <span className="ml-2 text-muted-foreground">
                                      정원 {slot.applied_count}/{slot.capacity}
                                    </span>
                                    {full && <Badge variant="warning" className="ml-2">마감</Badge>}
                                    {teamApplyLocked && !full && !alreadyAppliedEvent ? (
                                      <Badge variant="outline" className="ml-2">24시간 대기</Badge>
                                    ) : null}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant={blocked ? "outline" : "accent"}
                                    disabled={blocked}
                                    onClick={() => {
                                      setApplyCtx({
                                        eventId: event.id,
                                        sessionId: primarySession.id,
                                        slotId: slot.id,
                                        eventTitle: event.title,
                                        venue: event.venue,
                                        date: primarySession.date,
                                        slotStart: slot.start_time,
                                        capacity: slot.capacity,
                                        applied: slot.applied_count,
                                        usePositions: event.usePositions,
                                        positions: event.positions,
                                        ...(isGroup && session.groupId ? {
                                          groupId: session.groupId,
                                          groupDates: groupSessions!.map((s) => s.date),
                                          groupSessionIds: groupSessions!.map((s) => s.id),
                                        } : {}),
                                      });
                                      setApplyOpen(true);
                                    }}
                                  >
                                    {alreadyAppliedEvent
                                      ? "신청 완료"
                                      : event.closed
                                        ? "신청 마감"
                                        : event.locked
                                          ? "신청 잠금"
                                          : full
                                            ? "마감"
                                            : teamApplyLocked
                                              ? "대기 중"
                                              : !windowOpen
                                                ? EVENT_APPLY_WINDOW_LABEL[windowStatus]
                                                : "신청"}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </CardContent>
                    )}
                  </Card>
                );
              })})()}
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
