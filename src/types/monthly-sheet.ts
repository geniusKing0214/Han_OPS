import type { ApplicationStatus } from "@/types/application";
import type { TeamFilterValue, TeamId } from "@/types/team";

/** 관리자가 슬롯/날짜별로 덮어쓰는 필드 */
export type SheetEntryOverride = {
  eventTitle?: string;
  venue?: string;
  slotTime?: string;
  displayMemo?: string;
  headcount?: number;
  color?: string;
  extraMemo?: string;
};

/** 날짜(YYYY-MM-DD) 단위 관리자 오버라이드 */
export type SheetDayOverride = {
  color?: string;
  customMemo?: string;
  manualText?: string;
  entryOverrides?: Record<string, SheetEntryOverride>;
};

export type MonthlySheetDoc = {
  year: number;
  month: number;
  teamId: TeamId;
  adminMemo?: string;
  dayOverrides?: Record<string, SheetDayOverride>;
  updatedAt?: unknown;
};

export type SheetApplicant = {
  name: string;
  status: ApplicationStatus;
  positionLabel?: string;
  /** 연속 일정 묶음 날짜 목록 — 있으면 "(X일)" 뱃지 표시 */
  groupDates?: string[];
};

/** 캘린더 셀·상세에 표시할 슬롯 단위 행 */
export type SheetSlotRow = {
  entryKey: string;
  /** 인력 배치 스케줄러에서 자동 집계된 행 */
  workforceScheduleId?: string;
  eventId: string;
  sessionId: string;
  slotId: string;
  date: string;
  /** 연속 일정 묶음 ID (있으면 그룹 신청) */
  groupId?: string;
  /** 묶음 전체 날짜 목록 */
  groupDates?: string[];
  /** 묶음 전체 세션 ID 목록 */
  groupSessionIds?: string[];
  teamId: TeamId;
  eventTitle: string;
  venue: string;
  slotTime: string;
  capacity: number;
  headcount: number;
  applicants: SheetApplicant[];
  eventNotice?: string;
  eventColor?: string;
  statusLabel: string;
  displayLines: string[];
  override?: SheetEntryOverride;
};

export type SheetDayBundle = {
  date: string;
  rows: SheetSlotRow[];
  dayOverride?: SheetDayOverride;
  markerColors: string[];
  cellPreviewLines: string[];
};

export type MonthlySheetViewOptions = {
  month: Date;
  teamFilter: TeamFilterValue;
  includePending: boolean;
  isAdmin: boolean;
  memberTeamId?: TeamId;
};

export function monthlySheetDocId(
  year: number,
  month: number,
  teamId: TeamId,
): string {
  const mm = String(month).padStart(2, "0");
  return `${year}${mm}_${teamId}`;
}

export function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthLabelFromDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}
