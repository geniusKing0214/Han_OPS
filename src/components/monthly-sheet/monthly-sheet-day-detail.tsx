"use client";

import { ChevronDown, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusBadgeVariant } from "@/lib/admin-application-roster";
import {
  EVENT_APPLY_WINDOW_BADGE_CLASS,
  EVENT_APPLY_WINDOW_LABEL,
  resolveEventApplyStatus,
} from "@/lib/application-window";
import { cn } from "@/lib/utils";
import type { SheetApplicant, SheetDayBundle, SheetSlotRow } from "@/types/monthly-sheet";
import type { EventItem } from "@/types/schedule";
import { sessionAwarePositions } from "@/types/schedule";
import { TEAM_LABELS } from "@/types/team";
import type { WorkforceAvailability } from "@/types/workforce";
import type { ApplySlotContext } from "@/components/schedule/apply-slot";

function statusLabel(status: string): string {
  if (status === "approved") return "승인";
  if (status === "completed") return "완료";
  if (status === "pending") return "대기";
  if (status === "rejected") return "거절";
  return status;
}

function pendingCount(row: SheetSlotRow): number {
  return row.applicants.filter((a) => a.status === "pending").length;
}

function applicantBadgeLabel(a: SheetApplicant): string {
  return (a.status === "approved" || a.status === "completed") && a.positionLabel
    ? a.positionLabel
    : statusLabel(a.status);
}

type ApplicantGroup = {
  label: string;
  variant: "success" | "warning" | "destructive" | "default";
  applicants: SheetApplicant[];
};

/** 포지션(또는 상태) 뱃지가 같은 신청자끼리 묶어 뱃지를 한 번만 보여준다 */
function groupApplicants(applicants: SheetApplicant[]): ApplicantGroup[] {
  const groups: ApplicantGroup[] = [];
  const indexByLabel = new Map<string, number>();
  for (const a of applicants) {
    const label = applicantBadgeLabel(a);
    let idx = indexByLabel.get(label);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(label, idx);
      groups.push({ label, variant: statusBadgeVariant(a.status), applicants: [] });
    }
    groups[idx]!.applicants.push(a);
  }
  return groups;
}

function ApplicantExtraBadge({ a }: { a: SheetApplicant }) {
  if (a.packageDates && a.packageDates.length > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1 py-px text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/25">
        {a.packageLabel ? `${a.packageLabel} ` : ""}
        {a.packageDates.length}일
      </span>
    );
  }
  if (a.groupDates && a.groupDates.length > 1) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-500/15 px-1 py-px text-[10px] font-semibold text-blue-700 ring-1 ring-blue-500/25">
        {a.groupDates.length}일
      </span>
    );
  }
  return null;
}

export function MonthlySheetDayDetail({
  bundle,
  dateLabel,
  showTeamBadge,
  onEditSchedule,
  onApply,
  events,
  myAppliedEventIds,
  myAvailability,
  className,
}: {
  bundle: SheetDayBundle | null;
  dateLabel: string;
  showTeamBadge?: boolean;
  onEditSchedule?: (row: SheetSlotRow) => void;
  onApply?: (ctx: ApplySlotContext) => void;
  events?: EventItem[];
  myAppliedEventIds?: Set<string>;
  /** 신청 가능 기간이어도 익주 근무 가능일을 제출 안 했으면 신청불가 처리 */
  myAvailability?: WorkforceAvailability | null;
  className?: string;
}) {
  // 기본적으로 전부 접힌 상태 — 사용자가 직접 눌러야만 펼쳐진다
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const toggleRow = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!bundle || bundle.rows.length === 0) {
    return (
      <div className={cn("space-y-1", className)}>
        {bundle?.dayOverride?.manualText ? (
          <p className="px-1 text-sm text-accent md:text-base">
            {bundle.dayOverride.manualText}
          </p>
        ) : null}
        <p className="px-1 text-sm text-muted-foreground md:text-base">
          이 날짜에 표시할 일정이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1 md:space-y-2", className)}>
      {bundle.dayOverride?.manualText ? (
        <p className="px-1 pb-1 text-sm text-accent md:text-base">
          {bundle.dayOverride.manualText}
        </p>
      ) : null}
      {bundle.dayOverride?.customMemo ? (
        <p className="whitespace-pre-wrap px-1 pb-1 text-xs text-muted-foreground md:text-sm">
          {bundle.dayOverride.customMemo}
        </p>
      ) : null}

      {/* 아코디언 목록 */}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card md:rounded-xl">
        {bundle.rows.map((row) => {
          const isOpen = expandedKeys.has(row.entryKey);
          const accentColor = row.override?.color || row.eventColor;
          const newCount = pendingCount(row);

          return (
            <div key={row.entryKey}>
              {/* 아코디언 헤더 */}
              <button
                type="button"
                onClick={() => toggleRow(row.entryKey)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30 md:gap-3 md:px-4 md:py-3.5"
              >
                {/* 이벤트 색상 점 */}
                <span
                  className="size-2 shrink-0 rounded-full md:size-2.5"
                  style={{
                    backgroundColor: accentColor ?? "hsl(var(--accent))",
                  }}
                  aria-hidden
                />

                {/* 이벤트 이름 + 서브텍스트 */}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {showTeamBadge ? (
                      <Badge variant="outline" className="text-[9px] md:text-[11px]">
                        {TEAM_LABELS[row.teamId]}
                      </Badge>
                    ) : null}
                    <span className="truncate text-sm font-medium md:text-base">
                      {row.override?.eventTitle ?? row.eventTitle}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground md:text-sm">
                    {row.override?.venue ?? row.venue} ·{" "}
                    {row.override?.slotTime ?? row.slotTime}
                  </p>
                  {row.groupId && row.groupDates && row.groupDates.length > 1 ? (
                    <span className="mt-0.5 inline-flex items-center rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-500/25">
                      {(() => {
                        const sorted = [...row.groupDates].sort();
                        return `${sorted[0]} ~ ${sorted[sorted.length - 1]} (${sorted.length}일)`;
                      })()}
                    </span>
                  ) : null}
                </div>

                {/* 미확인 신청 배지 */}
                {newCount > 0 ? (
                  <span className="shrink-0 rounded-full bg-red-500/90 px-1.5 py-px text-[9px] font-bold text-white md:px-2 md:text-xs">
                    NEW {newCount}
                  </span>
                ) : row.applicants.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9px] text-muted-foreground md:px-2 md:text-xs">
                    신청 {row.applicants.length}
                  </span>
                ) : null}

                {/* 펼침 아이콘 */}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 md:size-5",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {/* 아코디언 바디 */}
              {isOpen ? (
                <div className="border-t border-border bg-muted/10 px-3 py-3 md:px-4 md:py-4">
                  {/* 상세 정보 */}
                  {(() => {
                    const ev = events?.find((e) => e.id === row.eventId);
                    const alreadyApplied = myAppliedEventIds?.has(row.eventId);
                    // 포지션 슬롯(Option B)의 정원 카운트는 세션(날짜)별로
                    // event.sessions[].positionSlotCounts에 저장되므로, 그대로
                    // event.positions를 쓰면 slot.applied_count가 항상 0으로
                    // 보여 정원이 다 찬 뒤에도 계속 신청을 받는 문제가 있었다.
                    // 그룹(연속) 신청은 그룹의 첫 세션 카운트를 기준으로 본다.
                    const primarySession =
                      row.groupId && row.groupSessionIds && row.groupSessionIds.length > 0
                        ? ev?.sessions
                            .filter((s) => row.groupSessionIds!.includes(s.id))
                            .sort((a, b) => a.date.localeCompare(b.date))[0]
                        : ev?.sessions.find((s) => s.id === row.sessionId);
                    const sessionPositions =
                      ev && primarySession
                        ? sessionAwarePositions(ev.positions, primarySession)
                        : (ev?.positions ?? []);
                    const hasPositions =
                      ev?.usePositions &&
                      sessionPositions.some((p) => p.slots && p.slots.length > 0);
                    const positionsFull =
                      !!hasPositions &&
                      !sessionPositions.some((p) =>
                        p.slots.some((s) => s.applied_count < s.capacity),
                      );
                    if (onApply && ev) {
                      const windowStatus = resolveEventApplyStatus(
                        row.date,
                        myAvailability ?? null,
                        ev.forceApplyOpen,
                      );
                      return (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold md:text-xs",
                              EVENT_APPLY_WINDOW_BADGE_CLASS[windowStatus],
                            )}
                          >
                            {EVENT_APPLY_WINDOW_LABEL[windowStatus]}
                          </span>
                          {ev.forceApplyOpen ? (
                            <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                              상시신청
                            </span>
                          ) : null}
                          {alreadyApplied ? (
                            <Button size="sm" variant="outline" disabled className="w-full md:w-auto">
                              신청 완료
                            </Button>
                          ) : positionsFull ? (
                            <Button size="sm" variant="outline" disabled className="w-full md:w-auto">
                              정원 마감
                            </Button>
                          ) : ev?.closed || windowStatus === "closed" ? (
                            <Button size="sm" variant="outline" disabled className="w-full md:w-auto">
                              신청 마감
                            </Button>
                          ) : ev?.locked && !ev.forceApplyOpen ? (
                            <Button size="sm" variant="outline" disabled className="w-full md:w-auto">
                              신청 잠금
                            </Button>
                          ) : windowStatus !== "open" ? (
                            <Button size="sm" variant="outline" disabled className="w-full md:w-auto">
                              {EVENT_APPLY_WINDOW_LABEL[windowStatus]}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="accent"
                              className="w-full md:w-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                const groupCtx = row.groupId
                                  ? {
                                      groupId: row.groupId,
                                      groupDates: row.groupDates,
                                      groupSessionIds: row.groupSessionIds,
                                    }
                                  : {};
                                if (hasPositions) {
                                  onApply({
                                    eventId: ev.id,
                                    sessionId: row.sessionId,
                                    eventTitle: row.eventTitle,
                                    venue: row.venue,
                                    date: row.date,
                                    usePositions: true,
                                    positions: sessionPositions,
                                    ...groupCtx,
                                  });
                                } else {
                                  onApply({
                                    eventId: ev.id,
                                    sessionId: row.sessionId,
                                    slotId: row.slotId,
                                    eventTitle: row.eventTitle,
                                    venue: row.venue,
                                    date: row.date,
                                    slotStart: row.slotTime,
                                    capacity: row.capacity,
                                    applied: row.headcount,
                                    usePositions: ev.usePositions,
                                    positions: sessionPositions,
                                    ...groupCtx,
                                  });
                                }
                              }}
                            >
                              신청
                            </Button>
                          )}
                          {!alreadyApplied && windowStatus === "blocked" ? (
                            <Link
                              href="/my-availability"
                              className="text-xs text-accent underline-offset-2 hover:underline"
                            >
                              익주 근무 가능일 먼저 제출하기
                            </Link>
                          ) : null}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="mb-2 space-y-1 text-xs text-muted-foreground md:mb-3 md:space-y-1.5 md:text-sm">
                    <p>
                      <span className="inline-block w-10 font-medium text-foreground/60 md:w-12">
                        장소
                      </span>
                      {row.override?.venue ?? row.venue}
                    </p>
                    <p>
                      <span className="inline-block w-10 font-medium text-foreground/60 md:w-12">
                        시간
                      </span>
                      {row.override?.slotTime ?? row.slotTime}
                    </p>
                    <p>
                      <span className="inline-block w-10 font-medium text-foreground/60 md:w-12">
                        인원
                      </span>
                      {row.override?.headcount ?? row.headcount}명 / {row.capacity}
                      명 정원
                    </p>
                    <p>
                      <span className="inline-block w-10 font-medium text-foreground/60 md:w-12">
                        상태
                      </span>
                      {row.statusLabel}
                    </p>
                  </div>

                  {/* 일정 수정 버튼 */}
                  {onEditSchedule && !row.workforceScheduleId ? (
                    <div className="mb-2 md:mb-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs md:h-9 md:px-3 md:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSchedule(row);
                        }}
                      >
                        <Pencil className="size-3 md:size-3.5" />
                        일정 수정
                      </Button>
                    </div>
                  ) : row.workforceScheduleId ? (
                    <p className="mb-2 text-xs text-accent md:mb-3 md:text-sm">
                      인력 배치 스케줄러에서 자동 연동됨
                    </p>
                  ) : null}

                  {/* 신청자 목록 — 포지션(상태)·일수 뱃지는 그룹당 한 번만, 이름은 1행 5열 그리드로 */}
                  {row.applicants.length > 0 ? (
                    <div className="space-y-2">
                      {groupApplicants(row.applicants).map((group, gi) => (
                        <div key={`${row.entryKey}-g-${gi}`} className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={group.variant}
                              className="shrink-0 text-[10px] md:text-xs"
                            >
                              {group.label}
                            </Badge>
                            <ApplicantExtraBadge a={group.applicants[0]!} />
                          </div>
                          <div className="grid grid-cols-5 gap-x-2 gap-y-1">
                            {group.applicants.map((a, ai) => (
                              <span
                                key={ai}
                                className="truncate text-sm md:text-base"
                              >
                                {a.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground md:text-sm">
                      신청자 없음
                    </p>
                  )}

                  {/* 메모 */}
                  {row.override?.displayMemo ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/90 md:text-sm">
                      {row.override.displayMemo}
                    </p>
                  ) : null}
                  {row.override?.extraMemo ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground md:text-sm">
                      {row.override.extraMemo}
                    </p>
                  ) : null}
                  {row.eventNotice ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground md:text-sm">
                      [일정] {row.eventNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
