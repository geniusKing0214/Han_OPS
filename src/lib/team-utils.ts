import type { EventItem } from "@/types/schedule";
import {
  DEFAULT_TEAM_ID,
  normalizeTeamId,
  normalizeTeamIds,
  type TeamFilterValue,
  type TeamId,
} from "@/types/team";

export function eventVisibleToTeam(event: EventItem, teamId: TeamId): boolean {
  const teamIds = normalizeTeamIds(event.team_ids);
  return teamIds.includes(teamId);
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
): boolean {
  return eventVisibleToTeam(event, normalizeTeamId(userTeamId));
}

export { DEFAULT_TEAM_ID, normalizeTeamId, normalizeTeamIds };
