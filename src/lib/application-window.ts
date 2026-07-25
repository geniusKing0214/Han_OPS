import type { EventItem } from "@/types/schedule";
import { normalizeTeamIds, type TeamId } from "@/types/team";
import type { WorkforceAvailability } from "@/types/workforce";
import {
  getWeekStartMonday,
  parseYmd,
  shiftWeek,
  toYmd,
  weekdayKeyFromYmd,
} from "@/lib/workforce-dates";

/** 1팀 전용 등록 후 2팀 자동 오픈 지연 (시간) */
export const TEAM2_AUTO_OPEN_HOURS = 24;

export type EventApplyWindowStatus = "before" | "open" | "closed" | "blocked";

/**
 * 일정 신청 기간: 일정이 속한 주(익주) 바로 전 주의 화/수/목요일에만 신청 가능.
 * - 신청 주(전 주) 화/수/목: open (신청중)
 * - 신청 주(전 주) 월/금/토/일, 그 이후(일정 주 포함): closed (신청마감)
 * - 신청 주보다 이전(그 이전 주들): before (신청전)
 */
export function getEventApplyWindowStatus(
  eventDateYmd: string,
  now: Date = new Date(),
): EventApplyWindowStatus {
  const eventWeekStart = getWeekStartMonday(parseYmd(eventDateYmd));
  const applyWeekStart = shiftWeek(eventWeekStart, -1);
  const nowWeekStart = getWeekStartMonday(now);
  if (nowWeekStart < applyWeekStart) return "before";
  if (nowWeekStart > applyWeekStart) return "closed";
  const key = weekdayKeyFromYmd(toYmd(now));
  if (key === "tue" || key === "wed" || key === "thu") return "open";
  return "closed";
}

/**
 * 신청 기간(open)이더라도, 일정이 속한 주에 대한 근무 가능일을 아직
 * 제출하지 않았다면 신청할 수 없도록 blocked(신청불가)로 낮춘다.
 */
export function resolveEventApplyStatus(
  eventDateYmd: string,
  avail: WorkforceAvailability | null,
  now: Date = new Date(),
): EventApplyWindowStatus {
  const base = getEventApplyWindowStatus(eventDateYmd, now);
  if (base !== "open") return base;
  const eventWeekStart = getWeekStartMonday(parseYmd(eventDateYmd));
  const submitted = !!avail?.memberSubmittedWeeks.includes(eventWeekStart);
  return submitted ? "open" : "blocked";
}

export const EVENT_APPLY_WINDOW_LABEL: Record<EventApplyWindowStatus, string> = {
  before: "신청전",
  open: "신청중",
  closed: "신청마감",
  blocked: "신청불가",
};

export const EVENT_APPLY_WINDOW_BADGE_CLASS: Record<
  EventApplyWindowStatus,
  string
> = {
  before: "bg-muted text-muted-foreground",
  open: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-red-500/15 text-red-300",
  blocked: "bg-amber-500/15 text-amber-300",
};

export function hasTeam2Stagger(event: EventItem): boolean {
  const teamIds = normalizeTeamIds(event.team_ids);
  return Boolean(
    event.team2ApplyOpensAt &&
      teamIds.includes("team_1") &&
      !teamIds.includes("team_2"),
  );
}

/** 1팀만 등록한 일정에 대해 2팀 신청 오픈 시각을 계산 */
export function computeTeam2ApplyOpensAt(
  createdAt: Date = new Date(),
  hours = TEAM2_AUTO_OPEN_HOURS,
): string {
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function getTeam2ApplyOpensAt(event: EventItem): Date | null {
  if (!hasTeam2Stagger(event) || !event.team2ApplyOpensAt) return null;
  const d = new Date(event.team2ApplyOpensAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function canTeamApplyNow(
  event: EventItem,
  teamId: TeamId,
  now = new Date(),
): boolean {
  if (teamId !== "team_2") return true;
  const opensAt = getTeam2ApplyOpensAt(event);
  if (!opensAt) return true;
  return now.getTime() >= opensAt.getTime();
}

export function formatTeam2ApplyOpensAt(event: EventItem): string | null {
  const opensAt = getTeam2ApplyOpensAt(event);
  if (!opensAt) return null;
  return opensAt.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTeam2ApplyCountdown(
  event: EventItem,
  now = new Date(),
): string | null {
  const opensAt = getTeam2ApplyOpensAt(event);
  if (!opensAt) return null;
  const ms = opensAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0
      ? `${days}일 ${remHours}시간 후 신청 가능`
      : `${days}일 후 신청 가능`;
  }
  if (hours > 0) {
    return minutes > 0
      ? `${hours}시간 ${minutes}분 후 신청 가능`
      : `${hours}시간 후 신청 가능`;
  }
  return `${Math.max(minutes, 1)}분 후 신청 가능`;
}
