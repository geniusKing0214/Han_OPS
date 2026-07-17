import { canTeamApplyNow, hasTeam2Stagger } from "@/lib/application-window";
import type { EventItem } from "@/types/schedule";
import {
  DEFAULT_TEAM_ID,
  normalizeTeamId,
  normalizeTeamIds,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";

/**
 * 일정 노출 여부.
 * 1팀만 등록 + 2팀 자동 오픈이 설정된 경우, 2팀에게도 목록에 보이게 함
 * (신청은 canTeamApplyNow / userCanApplyToEvent 로 24시간 후부터).
 */
export function eventVisibleToTeam(event: EventItem, teamId: TeamId): boolean {
  const teamIds = normalizeTeamIds(event.team_ids);
  if (teamIds.includes(teamId)) return true;
  if (teamId === "team_2" && hasTeam2Stagger(event)) return true;
  return false;
}

export function filterEventsByTeamFilter(
  events: EventItem[],
  filter: TeamFilterValue,
): EventItem[] {
  if (filter === "all") return events;
  return events.filter((ev) => eventVisibleToTeam(ev, filter));
}

export function filterEventsForMember(
  events: EventItem[],
  memberTeamId: TeamId | undefined,
): EventItem[] {
  const teamId = normalizeTeamId(memberTeamId);
  return events.filter((ev) => eventVisibleToTeam(ev, teamId));
}

export function userCanApplyToEvent(
  userTeamId: TeamId | undefined,
  event: EventItem,
  now = new Date(),
): boolean {
  const teamId = normalizeTeamId(userTeamId);
  if (!eventVisibleToTeam(event, teamId)) return false;
  return canTeamApplyNow(event, teamId, now);
}

export { DEFAULT_TEAM_ID, normalizeTeamId, normalizeTeamIds };
