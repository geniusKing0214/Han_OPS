export const TEAM_IDS = ["team_1", "team_2"] as const;

export type TeamId = (typeof TEAM_IDS)[number];

export type TeamFilterValue = "all" | TeamId;

export const DEFAULT_TEAM_ID: TeamId = "team_1";

export const TEAM_LABELS: Record<TeamId, string> = {
  team_1: "1팀",
  team_2: "2팀",
};

/** 스케줄 노출 범위 (생성 UI) */
export type TeamExposure = TeamId | "all";

export const TEAM_EXPOSURE_OPTIONS: { value: TeamExposure; label: string }[] = [
  { value: "team_1", label: "1팀" },
  { value: "team_2", label: "2팀" },
  { value: "all", label: "전체팀" },
];

export function teamExposureToTeamIds(exposure: TeamExposure): TeamId[] {
  if (exposure === "all") return [...TEAM_IDS];
  return [exposure];
}

export function teamIdsToExposure(teamIds: TeamId[]): TeamExposure {
  const normalized = normalizeTeamIds(teamIds);
  if (
    normalized.length === TEAM_IDS.length &&
    TEAM_IDS.every((id) => normalized.includes(id))
  ) {
    return "all";
  }
  return normalized[0] ?? DEFAULT_TEAM_ID;
}

export function normalizeTeamId(value: unknown): TeamId {
  if (value === "team_1" || value === "team_2") return value;
  return DEFAULT_TEAM_ID;
}

export function normalizeTeamIds(value: unknown): TeamId[] {
  if (!Array.isArray(value)) return [DEFAULT_TEAM_ID];
  const ids = value.filter(
    (v): v is TeamId => v === "team_1" || v === "team_2",
  );
  return ids.length > 0 ? [...new Set(ids)] : [DEFAULT_TEAM_ID];
}

export function formatTeamIdsLabel(teamIds: TeamId[]): string {
  const normalized = normalizeTeamIds(teamIds);
  if (
    normalized.length === TEAM_IDS.length &&
    TEAM_IDS.every((id) => normalized.includes(id))
  ) {
    return "전체팀";
  }
  return normalized.map((id) => TEAM_LABELS[id]).join(" · ");
}
