import type { EventItem } from "@/types/schedule";
import { normalizeTeamIds, type TeamId } from "@/types/team";

/** 1팀 전용 등록 후 2팀 자동 오픈 지연 (시간) */
export const TEAM2_AUTO_OPEN_HOURS = 24;

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
